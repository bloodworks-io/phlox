import asyncio
import json
import logging
import random
import re
import time
from typing import Dict, List, Union

from server.database.config.manager import config_manager
from server.schemas.grammars import MultiFieldResponse
from server.schemas.templates import TemplateField, TemplateResponse
from server.utils.llm_client.client import get_llm_client
from server.utils.transcription.refinement import refine_field_content

logger = logging.getLogger(__name__)


async def process_transcription(
    transcript_text: str,
    template_fields: List[TemplateField],
    patient_context: Dict[str, str],
    is_ambient: bool = True,
) -> Dict[str, Union[str, float]]:
    """
    Process the transcribed text to generate summaries for non-persistent template fields.

    Args:
        transcript_text (str): The transcribed text to process.
        template_fields (List[TemplateField]): The fields to process.
        patient_context (Dict[str, str]): Patient context (name, dob, gender, etc.).
        is_ambient (bool): Whether the transcript is from an ambient session (True) or direct dictation (False).
    Returns:
        dict: A dictionary containing:
            - 'fields' (Dict[str, str]): Processed field data.
            - 'process_duration' (float): The time taken for processing.
    """
    process_start = time.perf_counter()

    try:
        # Filter for non-persistent fields only
        non_persistent_fields = [
            field for field in template_fields if not field.persistent
        ]

        total_fields = len(non_persistent_fields)

        # Process only non-persistent fields concurrently with mode-specific summarization
        mode_label = "Ambient" if is_ambient else "Dictate"
        logger.info(f"Processing {total_fields} fields ({mode_label} Mode)...")
        raw_results_dict = await process_all_fields_concurrently(
            transcript_text, non_persistent_fields, patient_context, is_ambient
        )
        # Convert to list of TemplateResponse for compatibility with refinement step
        raw_results = [
            TemplateResponse(field_key=k, content=v)
            for k, v in raw_results_dict.items()
        ]
        logger.info(f"Successfully summarised {total_fields} fields")

        # Refine all results concurrently
        logger.info(f"Refining {total_fields} fields...")
        refined_results = await asyncio.gather(
            *[
                refine_field_content(
                    result.content, field, is_ambient=is_ambient
                )
                for result, field in zip(raw_results, non_persistent_fields)
            ]
        )
        logger.info(f"Successfully refined {total_fields} fields")

        # Combine results into a dictionary
        processed_fields = {
            field.field_key: refined_content
            for field, refined_content in zip(
                non_persistent_fields, refined_results
            )
        }

        process_duration = time.perf_counter() - process_start

        return {
            "fields": processed_fields,
            "process_duration": float(f"{process_duration:.2f}"),
        }

    except Exception as e:
        logger.error(f"Error in process_transcription: {e}")
        raise


async def process_all_fields_concurrently(
    transcript_text: str,
    fields: List[TemplateField],
    patient_context: Dict[str, str],
    is_ambient: bool = True,
) -> Dict[str, str]:
    """
    Process all template fields in a single LLM call using structured output.

    Builds a unified prompt with all field system prompts and patient context,
    then parses the multi-field response into a dictionary of formatted contents.

    Args:
        transcript_text: The transcribed text to process.
        fields: List of TemplateField objects to process.
        patient_context: Patient context (name, dob, gender, etc.).
        is_ambient: Whether the transcript is from an ambient session (True) or direct dictation (False).

    Returns:
        Dict mapping field_key to formatted content string with bullet points.
    """

    max_retries = 1

    for attempt in range(max_retries + 1):
        try:
            config = config_manager.get_config()
            options = config_manager.get_prompts_and_options()["options"][
                "general"
            ]

            client = get_llm_client()
            response_format = MultiFieldResponse.model_json_schema()
            model_name = config["PRIMARY_MODEL"]

            # Build the combined system prompt with all field instructions
            field_instructions = []
            for field in fields:
                field_instruction = f"""FIELD: {field.field_key}
NAME: {field.field_name}
INSTRUCTIONS: {(field.system_prompt or '').strip()}"""
                field_instructions.append(field_instruction)

            patient_context_str = _build_patient_context(patient_context)

            # Use mode-specific intro for the system prompt
            if is_ambient:
                intro = "Extract relevant information for each of the following fields from the medical transcript."
            else:
                intro = "Extract and organize information from the clinician's direct dictation for each of the following fields."

            system_content = f"""{intro}

{patient_context_str}

For each field, extract only the most relevant discussion points. If no relevant information is found for a field, return an empty list for that field.

FIELDS:
{chr(10).join(field_instructions)}

Output MUST be ONLY valid JSON with top-level key "field_summaries" (object mapping field_key to array of strings)."""

            request_body = [
                {"role": "system", "content": system_content},
                {"role": "user", "content": transcript_text},
            ]

            random_seed = random.randint(0, 2**32 - 1)

            logger.info(
                f"Processing {len(fields)} fields in one call (attempt {attempt + 1}/{max_retries + 1})..."
            )

            response = await client.chat(
                model=model_name,
                messages=request_body,
                format=response_format,
                options={**options, "seed": random_seed},
            )

            # Extract and repair JSON
            from server.utils.llm_client import repair_json

            content = response["message"]["content"]
            repaired_content = repair_json(content)

            # Validate against schema
            multi_field_response = MultiFieldResponse.model_validate_json(
                repaired_content
            )

            # Convert to dict of formatted strings (with bullet points)
            formatted_results = {}
            for field in fields:
                key_points = multi_field_response.field_summaries.get(
                    field.field_key, []
                )
                formatted_content = "\n".join(
                    f"• {_capitalize_first_char(point.strip())}"
                    for point in key_points
                )
                formatted_results[field.field_key] = formatted_content

            logger.info(f"Successfully processed {len(fields)}")

            return formatted_results

        except Exception as e:
            if attempt < max_retries:
                logger.warning(
                    f"Error processing all fields concurrently (attempt {attempt + 1}/{max_retries + 1}): {e}. Retrying..."
                )
                continue
            else:
                logger.error(
                    f"Error processing all fields concurrently after {max_retries + 1} attempts: {e}"
                )
                raise


def _capitalize_first_char(text: str) -> str:
    """Capitalize the first character of a string."""
    if not text:
        return text
    return text[0].upper() + text[1:] if text else text


# Helps to clean up double spaces
def clean_list_spacing(text: str) -> str:
    """Clean up extra spaces in list items and at line start."""
    # Fix numbered list items (e.g., "1.  text" -> "1. text")
    text = re.sub(r"(\d+\.)  +", r"\1 ", text)
    # Fix bullet points/dashes (e.g., "-  text" -> "- text")
    text = re.sub(r"([-•*])  +", r"\1 ", text)
    # Fix any double spaces at the start of lines
    text = re.sub(r"^\s{2,}", " ", text)
    return text.strip()


def _build_patient_context(context: Dict[str, str]) -> str:
    """
    Build patient context string from dictionary.

    Args:
        context (Dict[str, str]): Patient context (name, dob, gender, etc.).

    Returns:
        str: A formatted patient context string.
    """
    context_parts = []
    if context.get("name"):
        context_parts.append(f"Patient name: {context['name']}")
    if context.get("age"):
        context_parts.append(f"Age: {context['age']}")
    if context.get("gender"):
        context_parts.append(f"Gender: {context['gender']}")
    if context.get("dob"):
        context_parts.append(f"DOB: {context['dob']}")

    return " ".join(context_parts)
