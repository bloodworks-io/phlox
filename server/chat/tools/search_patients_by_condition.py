"""
Search patients by primary condition tool.
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
from server.database.repositories.patient_search import search_patients_by_condition

logger = logging.getLogger(__name__)


def format_condition_results(patients: list[dict], query: str) -> str:
    """Format a cohort result as a readable string for the LLM."""
    if not patients:
        return f"No patients found with a primary condition matching '{query}'."

    lines = [f"Found {len(patients)} patient(s) with condition matching '{query}':"]
    for p in patients:
        parts = [f"\n• {p.get('name', 'Unknown')}"]
        if p.get("ur_number"):
            parts.append(f"(UR: {p['ur_number']})")
        if p.get("primary_condition"):
            parts.append(f"[{p['primary_condition']}]")
        if p.get("dob"):
            parts.append(f"DOB: {p['dob']}")
        if p.get("last_encounter_date"):
            parts.append(f"Last seen: {p['last_encounter_date']}")
        if p.get("encounter_count"):
            parts.append(f"({p['encounter_count']} encounter(s))")
        lines.append(" ".join(parts))
        if p.get("encounter_summary"):
            lines.append(f"  Summary: {p['encounter_summary']}")
    return "\n".join(lines)


async def execute(
    tool_call: dict[str, Any],
    _llm_client,
    _config: dict[str, Any],
    message_list: list,
    _context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute the search_patients_by_condition tool."""
    logger.info("Executing search_patients_by_condition tool...")
    yield status_message("Searching patients by condition...")

    function_arguments: dict[str, Any] = {}
    if "arguments" in tool_call["function"]:
        try:
            if isinstance(tool_call["function"]["arguments"], str):
                function_arguments = json.loads(tool_call["function"]["arguments"])
            else:
                function_arguments = tool_call["function"]["arguments"]
        except json.JSONDecodeError:
            logger.error("Failed to parse function arguments JSON")

    condition = function_arguments.get("condition")
    limit = function_arguments.get("limit", 20)

    if not condition or not str(condition).strip():
        result_content = "Error: Please provide a condition to search for."
        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )
    else:
        try:
            patients = search_patients_by_condition(condition, limit)
            result_content = format_condition_results(patients, condition)
            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )
        except Exception as e:
            logger.error(f"Search patients by condition error: {e}")
            result_content = f"Error searching for patients by condition: {e}"
            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )

    yield end_message(function_response={"content": result_content, "citations": []})
