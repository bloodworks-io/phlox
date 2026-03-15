"""
System message and prompt configuration for the ChatEngine.

This module handles the construction of system messages and doctor context
for chat interactions.
"""

import logging
from datetime import datetime

from server.database.config.manager import config_manager
from server.utils.helpers import calculate_age

logger = logging.getLogger(__name__)


def _format_template_data(template_data: dict, fields: list) -> str:
    """
    Format template data into a readable string.

    Args:
        template_data: Dictionary of field_key -> value
        fields: List of field definitions with field_key and field_name

    Returns:
        Formatted string of template data
    """
    lines = []
    for field in fields:
        field_key = field.get("field_key")
        field_name = field.get("field_name", field_key)
        value = template_data.get(field_key, f"No {field_name.lower()} available")
        lines.append(f"{field_name}:")
        lines.append(value)
        lines.append("")  # Empty line for spacing
    return "\n".join(lines)


def build_system_messages(patient_context: dict | None = None, template_fields: list | None = None) -> list:
    """
    Build the system messages for chat interactions.

    Args:
        patient_context: Optional patient context containing name, dob, ur_number,
                        encounter_date, and template_data
        template_fields: Optional list of template field definitions for formatting

    Returns:
        list: A list containing a single system message with combined content.

    """
    prompts = config_manager.get_prompts_and_options()

    # Get user settings for doctor's name and specialty
    user_settings = config_manager.get_user_settings()
    doctor_name = user_settings.get("name", "")
    specialty = user_settings.get("specialty", "")

    # Start with the main system prompt
    content = prompts["prompts"]["chat"]["system"]

    today = datetime.now().strftime("%Y-%m-%d")
    today_readable = datetime.now().strftime("%A, %B %d, %Y")
    content += f"\n\nToday's date is {today_readable} ({today})."

    # Append doctor context if available
    if doctor_name or specialty:
        content += "\n\n"
        doctor_context = "You are assisting."
        if doctor_name and specialty:
            doctor_context += f" {doctor_name}, a {specialty} specialist."
        elif doctor_name:
            doctor_context += f" {doctor_name}."
        else:
            doctor_context += f" a {specialty} specialist."
        content += doctor_context

    # Add patient context if provided
    if patient_context:
        name = patient_context.get("name", "")
        dob = patient_context.get("dob", "")
        ur_number = patient_context.get("ur_number", "")
        encounter_date = patient_context.get("encounter_date")
        template_data = patient_context.get("template_data")

        # Calculate age
        age = ""
        if dob:
            try:
                age = calculate_age(dob, encounter_date)
            except ValueError:
                age = ""

        # Build patient header
        content += "\n\nHere is the most recent note that the doctor is working on for patient"
        patient_header_parts = []
        if name:
            patient_header_parts.append(name)
        if dob:
            patient_header_parts.append(f"DOB: {dob}")
        if age != "":
            patient_header_parts.append(f"{age} years old")
        if ur_number:
            patient_header_parts.append(f"UR: {ur_number}")

        if patient_header_parts:
            content += " " + ", ".join(patient_header_parts)

        # Add UR number context for tools
        if ur_number:
            content += f"\n\nPatient Context: UR Number is {ur_number}."

        # Add current encounter date for tools
        if encounter_date:
            content += f"\nCurrent Encounter Date: {encounter_date}."

        # Add template data (patient notes)
        if template_data and template_fields:
            formatted_notes = _format_template_data(template_data, template_fields)
            content += "\n\n" + formatted_notes

    return [{"role": "system", "content": content}]
