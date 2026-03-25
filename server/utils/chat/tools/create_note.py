"""
Create note tool implementation.

This tool creates a new patient encounter note for a specific date.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from server.database.entities.analysis import generate_previous_visit_summary
from server.database.entities.patient import (
    get_patient_by_id,
    save_patient,
    search_patient_by_ur_number,
)
from server.database.entities.templates import get_persistent_fields
from server.schemas.patient import Patient
from server.utils.chat.tools.patient_utils import find_ur_by_name
from server.utils.chat.streaming.response import (
    end_message,
    status_message,
    stream_llm_response,
    tool_response_message,
)

logger = logging.getLogger(__name__)

CREATE_NOTE_TOOL_NAME = "create_note"


def format_patient_name(name: str) -> str:
    """
    Format patient name to 'Last, First' format.
    """
    if not name or "," in name:
        return name  # Already formatted or empty

    parts = name.strip().split()
    if len(parts) == 1:
        return name  # Single word, return as-is

    # Last word is surname, rest is first name(s)
    return f"{parts[-1]}, {' '.join(parts[:-1])}"


async def _fetch_previous_encounter_data(ur_number: str) -> dict | None:
    """Fetch previous encounter data for a patient by UR number.

    Args:
        ur_number: The patient's UR number

    Returns:
        Dict with previous encounter data or None if not found:
        - patient_info: Basic patient info (name, dob, gender, ur_number)
        - template_data: Persistent fields from previous encounter
        - full_template_data: Complete template_data from previous encounter
        - template_key: Previous encounter's template key
        - encounter_date: Previous encounter date
        - encounter_id: Previous encounter ID
        - previous_visit_summary: Generated summary (if available)
    """
    try:
        # Search for the latest encounter by UR number
        encounters = search_patient_by_ur_number(ur_number)
        if not encounters:
            logger.info(f"No previous encounters found for UR number: {ur_number}")
            return None

        latest_encounter = encounters[0]
        encounter_id = latest_encounter.get("id")

        if not encounter_id:
            logger.warning(f"Latest encounter has no ID for UR number: {ur_number}")
            return None

        # Fetch full patient data to get all template_data fields
        full_patient = get_patient_by_id(encounter_id)
        if not full_patient:
            logger.warning(f"Could not fetch full patient data for ID: {encounter_id}")
            return None

        template_key = latest_encounter.get("template_key")

        # Get persistent fields for the template
        persistent_fields = []
        if template_key:
            persistent_fields = get_persistent_fields(template_key)

        # Build template_data with persistent fields
        full_template_data = full_patient.get("template_data", {})
        persistent_template_data = {}
        for field in persistent_fields:
            field_key = field.field_key if hasattr(field, 'field_key') else field.get('field_key')
            if field_key and field_key in full_template_data:
                persistent_template_data[field_key] = full_template_data[field_key]

        # Generate previous visit summary
        previous_visit_summary = None
        try:
            previous_visit_summary = await generate_previous_visit_summary(full_patient)
        except Exception as e:
            logger.warning(f"Could not generate previous visit summary: {e}")

        return {
            "patient_info": {
                "name": latest_encounter.get("name"),
                "dob": latest_encounter.get("dob"),
                "gender": latest_encounter.get("gender"),
                "ur_number": latest_encounter.get("ur_number"),
            },
            "template_data": persistent_template_data,
            "full_template_data": full_template_data,
            "template_key": template_key,
            "encounter_date": latest_encounter.get("encounter_date"),
            "encounter_id": encounter_id,
            "previous_visit_summary": previous_visit_summary,
        }
    except Exception as e:
        logger.error(f"Error fetching previous encounter data for UR {ur_number}: {e}")
        return None


async def create_patient_note(
    patient_name: str,
    encounter_date: str,
    ur_number: str | None = None,
    dob: str | None = None,
    initial_notes: str | None = None,
) -> dict:
    """Create a new patient encounter note with patient history support.

    When a UR number is provided, this function will:
    1. Search for the patient's previous encounter
    2. Pre-fill template_data with persistent fields from the previous encounter
    3. Include previous visit context for the frontend

    Args:
        patient_name: Full name of the patient
        encounter_date: Date of encounter in YYYY-MM-DD format
        ur_number: Patient's UR number (optional)
        dob: Patient's date of birth (optional)
        initial_notes: Any initial context (optional)

    Returns:
        Dict with success status, patient ID, and previous visit context
    """
    try:
        # Initialize template_data and previous visit context
        template_data = {}
        previous_visit_context = {}
        patient_gender = None
        patient_template_key = None

        # If UR number not provided, try to find patient by name
        if not ur_number and patient_name:
            logger.info(f"No UR number provided, searching for patient by name: {patient_name}")
            match = await find_ur_by_name(patient_name)
            if match:
                ur_number = match.ur_number
                logger.info(f"Found UR number {ur_number} for patient {patient_name}")

        # If UR number provided (or found by name), fetch patient history
        if ur_number:
            logger.info(f"Fetching previous encounter data for UR number: {ur_number}")
            previous_data = await _fetch_previous_encounter_data(ur_number)

            if previous_data:
                # Use persistent fields from previous encounter as base
                template_data = previous_data.get("template_data", {}).copy()

                # Get patient info from previous encounter if not explicitly provided
                patient_info = previous_data.get("patient_info", {})
                if not dob and patient_info.get("dob"):
                    dob = patient_info["dob"]
                if patient_info.get("gender"):
                    patient_gender = patient_info["gender"]
                if patient_info.get("name"):
                    patient_name = patient_info["name"]

                # Get template key from previous encounter
                patient_template_key = previous_data.get("template_key")

                # Store previous visit context for frontend
                previous_visit_context = {
                    "has_previous_history": True,
                    "previous_visit_template_data": previous_data.get("full_template_data"),
                    "previous_visit_template_key": previous_data.get("template_key"),
                    "previous_visit_encounter_date": previous_data.get("encounter_date"),
                    "previous_visit_summary": previous_data.get("previous_visit_summary"),
                }

                logger.info(f"Found previous encounter from {previous_data.get('encounter_date')} for patient {patient_name}")
            else:
                logger.info(f"No previous encounter found for UR number: {ur_number}, creating new patient record")

        # Merge initial_notes into template_data
        if initial_notes:
            template_data["initial_notes"] = initial_notes

        # Create patient record
        patient = Patient(
            name=format_patient_name(patient_name),
            dob=dob or "",
            ur_number=ur_number or "",
            gender=patient_gender,
            encounter_date=encounter_date,
            template_key=patient_template_key,
            template_data=template_data,
            raw_transcription=None,
            transcription_duration=None,
            process_duration=None,
        )

        patient_id = save_patient(patient)

        logger.info(f"Created patient note: ID={patient_id}, name={patient_name}, date={encounter_date}, ur_number={ur_number}")

        return {
            "success": True,
            "patient_id": patient_id,
            "message": f"Created note for {patient_name} on {encounter_date}",
            **previous_visit_context,  # Include previous visit context for frontend
        }
    except Exception as e:
        logger.error(f"Error creating patient note: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def execute(
    tool_call: dict[str, Any],
    llm_client,
    config: dict[str, Any],
    message_list: list,
    context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute the create_note tool.

    Args:
        tool_call: The tool call to execute
        llm_client: The LLM client instance
        config: The configuration dictionary
        message_list: The current message list
        context_question_options: The context question options

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    logger.info("Executing create_note tool...")
    yield status_message("Creating patient note...")

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

    patient_name = function_arguments.get("patient_name", "")
    encounter_date = function_arguments.get("encounter_date", "")
    ur_number = function_arguments.get("ur_number")
    dob = function_arguments.get("dob")
    initial_notes = function_arguments.get("initial_notes")

    result_content: str = ""
    citations: list[str] = []

    if not patient_name:
        result_content = "Error: Patient name is required to create a note."
    elif not encounter_date:
        result_content = "Error: Encounter date is required to create a note. Please provide the date in YYYY-MM-DD format."
    else:
        try:
            result = await create_patient_note(
                patient_name=patient_name,
                encounter_date=encounter_date,
                ur_number=ur_number,
                dob=dob,
                initial_notes=initial_notes,
            )

            if result["success"]:
                result_content = f"Successfully created note for {patient_name} on {encounter_date}."
                if ur_number:
                    result_content += f" UR number: {ur_number}."
                if result.get("patient_id"):
                    result_content += f" Patient ID: {result['patient_id']}."
                citations.append(f"Created note for {patient_name}")
            else:
                result_content = f"Failed to create note: {result.get('error', 'Unknown error')}"

        except Exception as e:
            logger.error(f"Create note error: {e}")
            result_content = f"Error creating note: {str(e)}"

    yield end_message(function_response={"content": result_content, "citations": citations})
