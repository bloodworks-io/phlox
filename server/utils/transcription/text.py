import asyncio
import logging
import random
import re
import time
from typing import Dict, List, Union

from server.database.config.manager import config_manager
from server.schemas.grammars import FieldResponse
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

        # Process only non-persistent fields concurrently and Summarise only if ambient
        if is_ambient:
            # Process only non-persistent fields concurrently
            logger.info(f"Processing {total_fields} fields (Ambient Mode)...")
            raw_results = await asyncio.gather(
                *[
                    process_template_field(
                        transcript_text, field, patient_context
                    )
                    for field in non_persistent_fields
                ]
            )
            logger.info(f"Successfully summarised {total_fields} fields")
        else:
            # Direct Dictation: Skip summarization, pass raw text
            logger.info(
                f"Skipping summarization for {total_fields} fields (Direct Dictation)..."
            )
            # Wrap raw text in TemplateResponse to match the expected structure for the next step
            raw_results = [
                TemplateResponse(
                    field_key=field.field_key, content=transcript_text
                )
                for field in non_persistent_fields
            ]

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


async def process_template_field(
    transcript_text: str, field: TemplateField, patient_context: Dict[str, str]
) -> TemplateResponse:
    """Process a single template field by extracting key points from the transcript text using a structured JSON output."""

    max_retries = 1

    for attempt in range(max_retries + 1):
        try:
            config = config_manager.get_config()
            options = config_manager.get_prompts_and_options()["options"][
                "general"
            ]

            # Initialize the appropriate client based on config
            client = get_llm_client()

            response_format = FieldResponse.model_json_schema()

            model_name = config["PRIMARY_MODEL"]

            # Prepare user content
            user_content = transcript_text

            request_body = [
                {
                    "role": "system",
                    "content": (f"{field.system_prompt}\n"),
                },
                {
                    "role": "system",
                    "content": _build_patient_context(patient_context),
                },
                {"role": "user", "content": user_content},
            ]

            # Generate random seed for diversity in outputs
            random_seed = random.randint(0, 2**32 - 1)

            # Setting temperature to 0 here makes the outputs semi-deterministic which is a problem if the user wants to reprocess because the initial output is not satisfactory; therefore, we set a low temperature (to ensure that decoding is not greedy) and set a random seed
            logger.info(
                f"Summarising transcript for field {field.field_key} (attempt {attempt + 1}/{max_retries + 1})..."
            )
            response = await client.chat(
                model=model_name,
                messages=request_body,
                format=response_format,
                options={**options, "seed": random_seed},
            )

            # Extract content from response based on provider type
            content = response["message"]["content"]

            # Import repair function
            from server.utils.llm_client import repair_json

            # Attempt to repair JSON before validation
            repaired_content = repair_json(content)

            # Validate the repaired content
            field_response = FieldResponse.model_validate_json(repaired_content)

            # Convert key points into a nicely formatted string
            formatted_content = "\n".join(
                f"• {point.strip()}" for point in field_response.key_points
            )

            return TemplateResponse(
                field_key=field.field_key, content=formatted_content
            )

        except Exception as e:
            if attempt < max_retries:
                logger.warning(
                    f"Error processing template field {field.field_key} (attempt {attempt + 1}/{max_retries + 1}): {e}. Retrying..."
                )
                continue
            else:
                logger.error(
                    f"Error processing template field {field.field_key} after {max_retries + 1} attempts: {e}"
                )
                raise


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
