"""
Search patient tool implementation.

This tool searches for patients by name, UR number, DOB, or other criteria.
Useful for finding existing patient records before creating notes.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from server.chat.streaming.response import (
    end_message,
    status_message,
    tool_response_message,
)
from server.chat.tools.patient_utils import rank_patients_by_name
from server.database.core.connection import get_db

logger = logging.getLogger(__name__)


async def search_patients(
    name: str | None = None,
    ur_number: str | None = None,
    dob: str | None = None,
    encounter_date: str | None = None,
    limit: int = 10,
) -> dict:
    """Search for patients matching the given criteria.

    Args:
        name: Patient name (partial match, case-insensitive)
        ur_number: Patient's UR number (partial match)
        dob: Date of birth in YYYY-MM-DD format
        encounter_date: Filter by encounter date in YYYY-MM-DD format
        limit: Maximum number of results to return

    Returns:
        Dict with success status and list of matching patients
    """
    try:
        search_name = name
        query = """
            SELECT e.ur_number, p.first_name, p.last_name, p.dob, p.gender,
                   MAX(e.encounter_date) as last_encounter,
                   COUNT(*) as encounter_count
            FROM encounters e
            LEFT JOIN patient_profiles p ON p.ur_number = e.ur_number
            WHERE 1=1
        """
        params = []

        if name:
            query += " AND LOWER(COALESCE(p.last_name || ', ' || p.first_name, '')) LIKE LOWER(?)"
            params.append(f"%{name}%")

        if ur_number:
            query += " AND e.ur_number LIKE ?"
            params.append(f"%{ur_number}%")

        if dob:
            query += " AND p.dob = ?"
            params.append(dob)

        if encounter_date:
            query += " AND e.encounter_date = ?"
            params.append(encounter_date)

        query += " GROUP BY e.ur_number, p.first_name, p.last_name, p.dob, p.gender"
        query += " ORDER BY last_encounter DESC"
        query += f" LIMIT {limit}"

        with get_db().read() as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()

        patients = []
        for row in rows:
            first = row["first_name"]
            last = row["last_name"]
            full_name = f"{last}, {first}" if (last and first) else (last or first or "")
            patients.append(
                {
                    "ur_number": row["ur_number"],
                    "name": full_name,
                    "dob": row["dob"],
                    "gender": row["gender"],
                    "last_encounter": row["last_encounter"],
                    "encounter_count": row["encounter_count"],
                }
            )

        if search_name:
            rank_patients_by_name(patients, search_name)

        return {
            "success": True,
            "patients": patients,
            "count": len(patients),
        }
    except Exception as e:
        logger.error(f"Error searching patients: {e}")
        return {"success": False, "error": str(e), "patients": [], "count": 0}


def format_search_results(result: dict) -> str:
    """Format search results as a readable string.

    Args:
        result: The result dict from search_patients

    Returns:
        Formatted string for display
    """
    if not result.get("success"):
        return f"Error: {result.get('error', 'Unknown error')}"

    patients = result.get("patients", [])
    if not patients:
        return "No patients found matching the search criteria."

    lines = [f"Found {len(patients)} patient(s):"]
    for p in patients:
        parts = [f"  • {p.get('name', 'Unknown')}"]
        if p.get("ur_number"):
            parts.append(f"(UR: {p['ur_number']})")
        if p.get("dob"):
            parts.append(f"DOB: {p['dob']}")
        if p.get("last_encounter"):
            parts.append(f"Last seen: {p['last_encounter']}")
        lines.append(" ".join(parts))

    return "\n".join(lines)


async def execute(
    tool_call: dict[str, Any],
    _llm_client,
    _config: dict[str, Any],
    message_list: list,
    _context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute the search_patient tool.

    Args:
        tool_call: The tool call to execute
        _llm_client: Unused (kept for signature compatibility with executor)
        _config: Unused (kept for signature compatibility with executor)
        message_list: The current message list
        _context_question_options: Unused (kept for signature compatibility with executor)

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    logger.info("Executing search_patient tool...")
    yield status_message("Searching for patients...")

    # Parse function arguments
    function_arguments = {}
    if "arguments" in tool_call["function"]:
        try:
            if isinstance(tool_call["function"]["arguments"], str):
                function_arguments = json.loads(tool_call["function"]["arguments"])
            else:
                function_arguments = tool_call["function"]["arguments"]
        except json.JSONDecodeError:
            logger.error("Failed to parse function arguments JSON")

    name = function_arguments.get("name")
    ur_number = function_arguments.get("ur_number")
    dob = function_arguments.get("dob")
    encounter_date = function_arguments.get("encounter_date")
    limit = function_arguments.get("limit", 10)

    result_content: str = ""
    citations: list[str] = []

    if not name and not ur_number and not dob and not encounter_date:
        result_content = "Error: Please provide at least one search criterion (name, UR number, DOB, or encounter date)."
        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )
    else:
        try:
            result = await search_patients(
                name=name,
                ur_number=ur_number,
                dob=dob,
                encounter_date=encounter_date,
                limit=limit,
            )

            result_content = format_search_results(result)

            if result.get("success") and result.get("patients"):
                citations.append(f"Found {result['count']} patient(s)")

            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )
        except Exception as e:
            logger.error(f"Search patient error: {e}")
            result_content = f"Error searching for patients: {str(e)}"
            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )

    yield end_message(function_response={"content": result_content, "citations": citations})
