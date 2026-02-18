import json
import logging
import random

from fastapi import HTTPException
from server.database.config.manager import config_manager
from server.schemas.grammars import LetterDraft
from server.utils.helpers import calculate_age
from server.utils.llm_client import repair_json
from server.utils.llm_client.client import get_llm_client


async def generate_letter_content(
    patient_name: str,
    gender: str,
    dob: str,
    template_data: dict,
    additional_instruction: str | None = None,
    context: list | None = None,
):
    """Generates letter content using the LLM client based on provided data and prompts."""
    config = config_manager.get_config()
    prompts = config_manager.get_prompts_and_options()
    llm_client = get_llm_client()

    age = calculate_age(dob)

    json_schema_instruction = (
        "Output MUST be ONLY valid JSON with top-level key "
        '"content" (string). Example: ' + json.dumps({"content": "..."})
    )

    try:
        # Always start with system messages
        request_body = [
            {
                "role": "system",
                "content": prompts["prompts"]["letter"]["system"]
                + "\n\n"
                + json_schema_instruction,
            },
        ]

        # Add doctor context if available
        user_settings = config_manager.get_user_settings()
        doctor_name = user_settings.get("name", "")
        specialty = user_settings.get("specialty", "")
        if doctor_name or specialty:
            doctor_context = "Write the letter in the voice of "
            doctor_context += f"{doctor_name}, " if doctor_name else ""
            doctor_context += (
                f"a {specialty} specialist." if specialty else "a specialist."
            )
            request_body.append({"role": "system", "content": doctor_context})

        # Format clinic note
        clinic_note = "\n\n".join(
            f"{key.replace('_', ' ').title()}:\n{value}"
            for key, value in template_data.items()
            if value
        )

        request_body.append(
            {
                "role": "user",
                "content": f"Before we proceed with the task; please take note of the following additional instructions:\n{additional_instruction}"
                or "",
            }
        )
        request_body.append(
            {
                "role": "user",
                "content": f"Patient Name: {patient_name}\nGender: {gender}\nAge: {age}\n\nClinic Note:\n{clinic_note}",
            }
        )

        # Add any context from the frontend
        if context:
            context_messages = context.copy()
            request_body.extend(context_messages)

        # Set up response format for structured output with thinking support
        base_schema = LetterDraft.model_json_schema()

        # Letter options
        options = prompts["options"]["general"].copy()  # General options
        options["temperature"] = prompts["options"]["letter"][
            "temperature"
        ]  # User defined temperature

        # Generate the letter content with structured output
        response_json = await llm_client.chat_with_structured_output(
            model=config["PRIMARY_MODEL"],
            messages=request_body,
            schema=base_schema,
            options=options,
        )

        # Some providers return a parsed dict; normalize to a JSON string first
        if not isinstance(response_json, str):
            response_json = json.dumps(response_json)

        # Repair JSON for flaky endpoints that wrap/format the output
        response_json = repair_json(response_json)

        # Parse the JSON response
        letter_content = LetterDraft.model_validate_json(response_json)
        return letter_content.content

    except Exception as e:
        logging.error(f"Error generating letter content: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error generating letter content: {e}"
        )


def _format_name(patient_name):
    """
    Formats the patient's name from 'Last, First' to 'First Last' format.

    Args:
        patient_name (str): The patient's name in 'Last, First' format.

    Returns:
        str: The formatted name in 'First Last' format.

    Raises:
        HTTPException: If the patient name is not provided.
    """
    if not patient_name:
        raise HTTPException(status_code=400, detail="Patient name is required")

    name_parts = patient_name.split(",")
    last_name = name_parts[0].strip()
    first_name = name_parts[1].strip()
    return f"{first_name} {last_name}"
