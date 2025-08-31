import random
import logging
import json
from fastapi import HTTPException
from server.database.config import config_manager
from server.schemas.grammars import LetterDraft
from server.utils.llm_client import get_llm_client
from server.utils.helpers import calculate_age


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

    try:
        # Always start with system messages
        request_body = [
            {
                "role": "system",
                "content": prompts["prompts"]["letter"]["system"] + "\nReturn JSON",
            },
            {"role": "system", "content": additional_instruction or ""},
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

        # Always include initial patient data as first user message
        user_message = {
            "role": "user",
            "content": f"Patient Name: {patient_name}\nGender: {gender}\nAge: {age}\n\nClinic Note:\n{clinic_note}",
        }

        # Add any context from the frontend
        if context:
            context_messages = context.copy()
            request_body.extend(context_messages)

        # Add user message to the main request body
        request_body.append(user_message)

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
