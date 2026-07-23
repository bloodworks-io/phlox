"""
Complete job tool implementation.

This tool marks a specific job as completed for a patient encounter.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from server.chat.streaming.response import (
    end_message,
    status_message,
)
from server.database.core.connection import get_db
from server.database.repositories.jobs import update_patient_jobs_list

logger = logging.getLogger(__name__)


async def complete_job(note_id: int, job_id: int) -> dict:
    """Mark a job as completed for a patient."""
    try:
        # Get the patient record
        get_db().cursor.execute(
            """
            SELECT e.id, e.ur_number, e.encounter_date, e.jobs_list,
                   p.first_name, p.last_name
            FROM encounters e
            LEFT JOIN patient_profiles p ON p.ur_number = e.ur_number
            WHERE e.id = ?
            """,
            (note_id,),
        )

        row = get_db().cursor.fetchone()

        if not row:
            return {"success": False, "error": f"No patient record found with ID: {note_id}"}

        patient = dict(row)
        first = patient.get("first_name")
        last = patient.get("last_name")
        patient_name = f"{last}, {first}" if (last and first) else (last or first or "")

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

        if not jobs_list:
            return {"success": False, "error": f"No jobs found for patient record {note_id}"}

        # Find and update the job
        job_found = False
        job_description = None
        already_completed = False

        for job in jobs_list:
            if job.get("id") == job_id:
                job_found = True
                job_description = job.get("job", job.get("task", "Unknown task"))
                if job.get("completed", False):
                    already_completed = True
                else:
                    job["completed"] = True
                break

        if not job_found:
            return {
                "success": False,
                "error": f"No job with ID {job_id} found in patient record {note_id}",
            }

        if already_completed:
            return {
                "success": True,
                "already_completed": True,
                "patient": {
                    "name": patient_name,
                    "ur_number": patient["ur_number"],
                    "encounter_date": patient["encounter_date"],
                },
                "job": {"id": job_id, "description": job_description},
                "message": f"Job '{job_description}' was already marked as complete.",
            }

        # Update the jobs list in the database
        update_patient_jobs_list(note_id, jobs_list)

        return {
            "success": True,
            "already_completed": False,
            "patient": {
                "name": patient_name,
                "ur_number": patient["ur_number"],
                "encounter_date": patient["encounter_date"],
            },
            "job": {"id": job_id, "description": job_description},
            "message": f"Job '{job_description}' marked as complete.",
        }

    except Exception as e:
        logger.error(f"Error completing job: {e}")
        return {"success": False, "error": str(e)}


def format_complete_job_response(result: dict) -> str:
    """Format the complete job result as a readable string.

    Args:
        result: The result dict from complete_job

    Returns:
        Formatted string for display
    """
    if not result.get("success"):
        return f"Error: {result.get('error', 'Unknown error')}"

    patient = result.get("patient", {})
    job = result.get("job", {})
    message = result.get("message", "Job updated.")

    parts = [
        f"Patient: {patient.get('name', 'Unknown')}",
        f"UR Number: {patient.get('ur_number', 'N/A')}",
        f"Encounter Date: {patient.get('encounter_date', 'N/A')}",
        "",
        f"Job #{job.get('id')}: {job.get('description', 'Unknown task')}",
        "",
        message,
    ]

    return "\n".join(parts)


async def execute(
    tool_call: dict[str, Any],
    _llm_client,
    _config: dict[str, Any],
    _message_list: list,
    _context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute the complete_job tool.

    Args:
        tool_call: The tool call to execute
        llm_client: The LLM client instance
        config: The configuration dictionary
        message_list: The current message list
        context_question_options: The context question options

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    logger.info("Executing complete_job tool...")
    yield status_message("Marking job as complete...")

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

    note_id = function_arguments.get("note_id")
    job_id = function_arguments.get("job_id")

    result_content: str = ""
    citations: list[str] = []

    if note_id is None or job_id is None:
        result_content = "Error: Both note_id and job_id are required to complete a job."
    else:
        try:
            result = await complete_job(
                note_id=int(note_id),
                job_id=int(job_id),
            )

            result_content = format_complete_job_response(result)

            if result.get("success"):
                patient = result.get("patient", {})
                citations.append(f"Job completed for {patient.get('name', 'patient')}")

        except Exception as e:
            logger.error(f"Complete job error: {e}")
            result_content = f"Error completing job: {str(e)}"

    yield end_message(function_response={"content": result_content, "citations": citations})
