"""
List outstanding jobs tool implementation.

This tool retrieves all patients with outstanding (incomplete) jobs.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from server.database.entities.jobs import get_patients_with_outstanding_jobs
from server.utils.chat.streaming.response import (
    end_message,
    status_message,
)

logger = logging.getLogger(__name__)

LIST_OUTSTANDING_JOBS_TOOL_NAME = "list_outstanding_jobs"


def format_jobs_list(jobs_list: list) -> list[dict]:
    """Format jobs list for display.

    Args:
        jobs_list: List of job dicts

    Returns:
        List of formatted job dicts
    """
    formatted = []
    for job in jobs_list:
        if isinstance(job, dict) and not job.get("completed", False):
            formatted.append({
                "id": job.get("id"),
                "job": job.get("job", job.get("task", "Unknown task")),
                "completed": job.get("completed", False),
            })
    return formatted


async def list_outstanding_jobs() -> dict:
    """Get all patients with outstanding jobs.

    Returns:
        Dict with list of patients and their outstanding jobs
    """
    try:
        patients = get_patients_with_outstanding_jobs()

        results = []
        total_jobs = 0

        for patient in patients:
            jobs_list = patient.get("jobs_list", [])
            if isinstance(jobs_list, str):
                try:
                    jobs_list = json.loads(jobs_list)
                except json.JSONDecodeError:
                    jobs_list = []

            incomplete_jobs = format_jobs_list(jobs_list)

            if incomplete_jobs:
                total_jobs += len(incomplete_jobs)
                results.append({
                    "patient_id": patient["id"],
                    "name": patient.get("name", "Unknown"),
                    "ur_number": patient.get("ur_number"),
                    "dob": patient.get("dob"),
                    "encounter_date": patient.get("encounter_date"),
                    "jobs": incomplete_jobs,
                    "job_count": len(incomplete_jobs),
                })

        # Sort by encounter date (most recent first)
        results.sort(key=lambda x: x.get("encounter_date") or "", reverse=True)

        return {
            "success": True,
            "patients": results,
            "total_patients": len(results),
            "total_jobs": total_jobs,
        }

    except Exception as e:
        logger.error(f"Error listing outstanding jobs: {e}")
        return {"success": False, "error": str(e)}


def format_outstanding_jobs_response(result: dict) -> str:
    """Format the outstanding jobs result as a readable string.

    Args:
        result: The result dict from list_outstanding_jobs

    Returns:
        Formatted string for display
    """
    if not result.get("success"):
        return f"Error: {result.get('error', 'Unknown error')}"

    patients = result.get("patients", [])
    total_patients = result.get("total_patients", 0)
    total_jobs = result.get("total_jobs", 0)

    if not patients:
        return "No patients with outstanding jobs. All tasks are complete!"

    parts = [
        f"Outstanding Jobs Summary: {total_jobs} tasks across {total_patients} patient(s)",
        "",
        "=" * 50,
    ]

    for patient in patients:
        parts.append(f"\nPatient: {patient['name']}")
        parts.append(f"  UR Number: {patient.get('ur_number', 'N/A')}")
        parts.append(f"  Encounter Date: {patient.get('encounter_date', 'N/A')}")
        parts.append(f"  Patient ID: {patient['patient_id']}")
        parts.append(f"  Outstanding Jobs ({patient['job_count']}):")

        for job in patient["jobs"]:
            status = "○"
            parts.append(f"    {status} [ID: {job['id']}] {job['job']}")

        parts.append("-" * 40)

    return "\n".join(parts)


async def execute(
    tool_call: dict[str, Any],
    llm_client,
    config: dict[str, Any],
    message_list: list,
    context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute the list_outstanding_jobs tool.

    Args:
        tool_call: The tool call to execute
        llm_client: The LLM client instance
        config: The configuration dictionary
        message_list: The current message list
        context_question_options: The context question options

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    logger.info("Executing list_outstanding_jobs tool...")
    yield status_message("Retrieving outstanding jobs...")

    result_content: str = ""
    citations: list[str] = []

    try:
        result = await list_outstanding_jobs()
        result_content = format_outstanding_jobs_response(result)

        if result.get("success") and result.get("patients"):
            citations.append("Outstanding jobs list")

    except Exception as e:
        logger.error(f"List outstanding jobs error: {e}")
        result_content = f"Error retrieving outstanding jobs: {str(e)}"

    yield end_message(function_response={"content": result_content, "citations": citations})
