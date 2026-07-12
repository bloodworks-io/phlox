import json
import logging

from fastapi import HTTPException
from server.database.config.manager import config_manager
from server.schemas.grammars import LetterDraft
from server.utils.helpers import calculate_age
from server.utils.llm_client import repair_json
from server.utils.llm_client.client import get_llm_client


def _count_tokens(text: str) -> int:
    """Token count for budget guards. Lazy-imports tiktoken; falls back to len//4."""
    try:
        import tiktoken

        return len(tiktoken.get_encoding("cl100k_base").encode(text, disallowed_special=()))
    except (ImportError, ValueError):
        return len(text) // 4


def _truncate_context(messages: list[dict], max_tokens: int) -> list[dict]:
    """Trim a conversation context to fit a token budget.

    Repeatedly drops the oldest assistant turn (and any messages between it and
    the next assistant message) until the total is under budget. The result is
    guaranteed to start with an assistant message when one is present.
    """
    if not messages:
        return []

    def _total(msgs: list[dict]) -> int:
        return sum(_count_tokens(f"{m.get('role', '')}: {m.get('content', '')}") for m in msgs)

    working = list(messages)
    total = _total(working)

    while total > max_tokens and len(working) > 2:
        first_assistant = next(
            (i for i, m in enumerate(working) if m.get("role") == "assistant"), None
        )
        if first_assistant is None:
            break
        second_assistant = next(
            (
                i
                for i, m in enumerate(working)
                if m.get("role") == "assistant" and i > first_assistant
            ),
            None,
        )
        if second_assistant is not None:
            removed = working[first_assistant:second_assistant]
            del working[first_assistant:second_assistant]
            total -= _total(removed)
        else:
            break

    # Ensure the context starts with an assistant message
    first_assistant = next((i for i, m in enumerate(working) if m.get("role") == "assistant"), None)
    if first_assistant and first_assistant > 0:
        del working[:first_assistant]

    return working


async def generate_letter_content(
    patient_name: str,
    gender: str,
    dob: str,
    template_data: dict,
    additional_instruction: str | None = None,
    context: list | None = None,
):
    """Generates letter content using the LLM client based on provided data and prompts.

    Returns a dict with ``letter`` (the generated text) and ``context`` (the
    truncated conversation context actually used, so callers can stay in sync).
    """
    config = config_manager.get_config()
    prompts = config_manager.get_prompts_and_options()
    llm_client = get_llm_client()

    age = calculate_age(dob)

    json_schema_instruction = (
        "Output MUST be ONLY valid JSON with top-level key "
        '"content" (string). Example: ' + json.dumps({"content": "..."})
    )

    try:
        # Build a single system message (merge system prompt + doctor context)
        system_content = prompts["prompts"]["letter"]["system"] + "\n\n" + json_schema_instruction

        # Add doctor context if available
        user_settings = config_manager.get_user_settings()
        doctor_name = user_settings.get("name", "")
        specialty = user_settings.get("specialty", "")
        if doctor_name or specialty:
            system_content += "\n\n"
            doctor_context = "Write the letter in the voice of "
            doctor_context += f"{doctor_name}, " if doctor_name else ""
            doctor_context += f"a {specialty} specialist." if specialty else "a specialist."
            system_content += doctor_context

        request_body = [
            {"role": "system", "content": system_content},
        ]

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

        # Add any context from the frontend (server-side truncation keeps it in budget)
        num_ctx = prompts["options"]["general"].get("num_ctx", 7168)
        budget = int(num_ctx * 0.9)
        truncated_context = _truncate_context(
            [m for m in (context or []) if m.get("role") != "system"], budget
        )
        request_body.extend(truncated_context)

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
        return {"letter": letter_content.content, "context": truncated_context}

    except Exception as e:
        logging.error(f"Error generating letter content: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating letter content: {e}") from e


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
