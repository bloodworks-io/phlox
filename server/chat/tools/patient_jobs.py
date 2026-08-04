"""
Patient jobs tool implementation.

This tool retrieves outstanding jobs/tasks for a specific patient.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from server.chat.streaming.response import (
    end_message,
    status_message,
)
from server.chat.tools._helpers import parse_tool_args
from server.database.repositories.jobs import get_latest_encounter_with_jobs

logger = logging.getLogger(__name__)


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
        if not ur_number and not patient_name:
            return {"success": False, "error": "Either ur_number or patient_name is required"}

        row = get_latest_encounter_with_jobs(ur_number=ur_number, patient_name=patient_name)
        if not row:
            return {
                "success": False,
                "error": f"No patient found with {'UR: ' + ur_number if ur_number else 'name: ' + (patient_name or '')}",
            }

        patient = row

        # Parse jobs list
        jobs_list = []
        if patient.get("jobs_list"):
            try:
                jobs_list = (
                    json.loads(patient["jobs_list"])
                    if isinstance(patient["jobs_list"], str)
                    else patient["jobs_list"]
                )
            except json.JSONDecodeError:
                jobs_list = []

        # Filter to incomplete jobs
        incomplete_jobs = [job for job in jobs_list if not job.get("completed", False)]

        first = patient.get("first_name")
        last = patient.get("last_name")
        name = f"{last}, {first}" if (last and first) else (last or first or "")

        return {
            "success": True,
            "patient": {
                "id": patient["id"],
                "name": name,
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
    _llm_client,
    _config: dict[str, Any],
    _message_list: list,
    _context_question_options: dict[str, Any],
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

    function_arguments = parse_tool_args(tool_call)

    ur_number = function_arguments.get("ur_number")
    patient_name = function_arguments.get("patient_name")

    result_content: str = ""
    citations: list[str] = []

    if not ur_number and not patient_name:
        result_content = "Error: Please provide either a UR number or patient name to look up jobs."
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

        except Exception as e:
            logger.error(f"Get patient jobs error: {e}")
            result_content = f"Error retrieving patient jobs: {str(e)}"

    yield end_message(function_response={"content": result_content, "citations": citations})
