"""
Patient jobs tool implementation.

This tool retrieves outstanding jobs/tasks for a specific patient.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from server.database.core.connection import get_db
from server.utils.chat.streaming.response import (
    end_message,
    status_message,
    stream_llm_response,
    tool_response_message,
)

logger = logging.getLogger(__name__)

GET_PATIENT_JOBS_TOOL_NAME = "get_patient_jobs"


async def get_patient_jobs(
    ur_number: str | None = None,
    patient_name: str | None = None,
) -> dict:
    """Get outstanding jobs for a patient.

    Args:
        ur_number: Patient's UR number
        patient_name: Patient's name (if UR not known)

    Returns:
        Dict with patient info and their jobs list
    """
    try:
        if ur_number:
            # Search by UR number
            get_db().cursor.execute(
                """
                SELECT id, name, ur_number, dob, encounter_date, jobs_list
                FROM patients
                WHERE ur_number = ?
                ORDER BY encounter_date DESC
                LIMIT 1
                """,
                (ur_number,),
            )
        elif patient_name:
            # Search by name (case-insensitive partial match)
            get_db().cursor.execute(
                """
                SELECT id, name, ur_number, dob, encounter_date, jobs_list
                FROM patients
                WHERE LOWER(name) LIKE LOWER(?)
                ORDER BY encounter_date DESC
                LIMIT 1
                """,
                (f"%{patient_name}%",),
            )
        else:
            return {"success": False, "error": "Either ur_number or patient_name is required"}

        row = get_db().cursor.fetchone()
        if not row:
            return {
                "success": False,
                "error": f"No patient found with {'UR: ' + ur_number if ur_number else 'name: ' + patient_name}"
            }

        patient = dict(row)

        # Parse jobs list
        jobs_list = []
        if patient.get("jobs_list"):
            try:
                jobs_list = json.loads(patient["jobs_list"]) if isinstance(patient["jobs_list"], str) else patient["jobs_list"]
            except json.JSONDecodeError:
                jobs_list = []

        # Filter to incomplete jobs
        incomplete_jobs = [job for job in jobs_list if not job.get("completed", False)]

        return {
            "success": True,
            "patient": {
                "id": patient["id"],
                "name": patient["name"],
                "ur_number": patient["ur_number"],
                "dob": patient["dob"],
                "encounter_date": patient["encounter_date"],
            },
            "jobs": incomplete_jobs,
            "total_jobs": len(jobs_list),
            "incomplete_count": len(incomplete_jobs),
        }
    except Exception as e:
        logger.error(f"Error getting patient jobs: {e}")
        return {"success": False, "error": str(e)}


def format_jobs_response(result: dict) -> str:
    """Format the jobs result as a readable string.

    Args:
        result: The result dict from get_patient_jobs

    Returns:
        Formatted string for display
    """
    if not result.get("success"):
        return f"Error: {result.get('error', 'Unknown error')}"

    patient = result.get("patient", {})
    jobs = result.get("jobs", [])

    parts = [
        f"Patient: {patient.get('name', 'Unknown')}",
        f"UR Number: {patient.get('ur_number', 'N/A')}",
        f"Last Encounter: {patient.get('encounter_date', 'N/A')}",
        "",
    ]

    if not jobs:
        parts.append("No outstanding jobs.")
    else:
        parts.append(f"Outstanding Jobs ({len(jobs)}):")
        for job in jobs:
            status = "✓" if job.get("completed") else "○"
            parts.append(f"  {status} {job.get('job', job.get('task', 'Unknown task'))}")

    return "\n".join(parts)


async def execute(
    tool_call: dict[str, Any],
    llm_client,
    config: dict[str, Any],
    message_list: list,
    context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute the get_patient_jobs tool.

    Args:
        tool_call: The tool call to execute
        llm_client: The LLM client instance
        config: The configuration dictionary
        message_list: The current message list
        context_question_options: The context question options

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    logger.info("Executing get_patient_jobs tool...")
    yield status_message("Retrieving patient jobs...")

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

    ur_number = function_arguments.get("ur_number")
    patient_name = function_arguments.get("patient_name")

    result_content: str = ""
    citations: list[str] = []

    if not ur_number and not patient_name:
        result_content = "Error: Please provide either a UR number or patient name to look up jobs."
        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )
    else:
        try:
            result = await get_patient_jobs(
                ur_number=ur_number,
                patient_name=patient_name,
            )

            result_content = format_jobs_response(result)

            if result.get("success"):
                patient = result.get("patient", {})
                citations.append(f"Jobs for {patient.get('name', 'patient')}")

            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )
        except Exception as e:
            logger.error(f"Get patient jobs error: {e}")
            result_content = f"Error retrieving patient jobs: {str(e)}"
            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )

    if llm_client is not None:
        yield status_message("Generating response...")
        async for chunk in stream_llm_response(
            llm_client=llm_client,
            model=config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
        ):
            yield chunk

    yield end_message(function_response={"content": result_content, "citations": citations})
