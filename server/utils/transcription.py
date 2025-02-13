import aiohttp
import asyncio
import time
import re
import logging
from typing import Dict, List, Union
from ollama import AsyncClient as AsyncOllamaClient
from server.database.config import config_manager
from server.schemas.templates import TemplateField, TemplateResponse
from server.schemas.grammars import FieldResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def transcribe_audio(audio_buffer: bytes) -> Dict[str, Union[str, float]]:
    """
    Transcribe an audio buffer using a Whisper endpoint.

    Args:
        audio_buffer (bytes): The audio data to be transcribed.

    Returns:
        dict: A dictionary containing:
            - 'text' (str): The transcribed text.
            - 'transcriptionDuration' (float): The time taken for transcription.

    Raises:
        ValueError: If the transcription fails or no text is returned.
    """
    try:
        config = config_manager.get_config()
        async with aiohttp.ClientSession() as session:
            form_data = aiohttp.FormData()
            form_data.add_field(
                "file",
                audio_buffer,
                filename="recording.wav",
                content_type="audio/wav",
            )
            form_data.add_field("model", config["WHISPER_MODEL"])
            form_data.add_field("language", "en")
            form_data.add_field("temperature", "0.1")
            form_data.add_field("vad_filter", "true")
            form_data.add_field("response_format", "verbose_json")
            form_data.add_field("timestamp_granularities", "segment",)
            logger.info("Sending audio buffer for transcription")

            transcription_start = time.perf_counter()

            async with session.post(
                f"{config['WHISPER_BASE_URL']}audio/transcriptions",
                data=form_data,
            ) as response:
                transcription_end = time.perf_counter()
                transcription_duration = transcription_end - transcription_start

                if response.status != 200:
                    raise ValueError(
                        "Transcription failed, no text in response"
                    )

                data = await response.json()

                if "text" not in data:
                    raise ValueError(
                        "Transcription failed, no text in response"
                    )

                if "segments" in data:
                    # Extract text from each segment and join with newlines
                    transcript_text = '\n'.join(
                        segment["text"].strip()
                        for segment in data["segments"]
                    )
                else:
                    transcript_text = data["text"]

                return {
                    "text": transcript_text,
                    "transcriptionDuration": float(f"{transcription_duration:.2f}"),
                }
    except Exception as error:
        logger.error(f"Error in transcribe_audio function: {error}")
        raise

async def process_transcription(
    transcript_text: str,
    template_fields: List[TemplateField],
    patient_context: Dict[str, str]
) -> Dict[str, Union[str, float]]:
    """
    Process the transcribed text to generate summaries for non-persistent template fields.

    Args:
        transcript_text (str): The transcribed text to process.
        template_fields (List[TemplateField]): The fields to process.
        patient_context (Dict[str, str]): Patient context (name, dob, gender, etc.).

    Returns:
        dict: A dictionary containing:
            - 'fields' (Dict[str, str]): Processed field data.
            - 'process_duration' (float): The time taken for processing.
    """
    process_start = time.perf_counter()

    try:
        # Filter for non-persistent fields only
        non_persistent_fields = [field for field in template_fields if not field.persistent]

        # Process only non-persistent fields concurrently
        raw_results = await asyncio.gather(*[
            process_template_field(
                transcript_text,
                field,
                patient_context
            )
            for field in non_persistent_fields
        ])

        # Refine all results concurrently
        refined_results = await asyncio.gather(*[
            refine_field_content(
                result.content,
                field
            )
            for result, field in zip(raw_results, non_persistent_fields)
        ])

        # Combine results into a dictionary
        processed_fields = {
            field.field_key: refined_content
            for field, refined_content in zip(non_persistent_fields, refined_results)
        }

        process_duration = time.perf_counter() - process_start

        return {
            "fields": processed_fields,
            "process_duration": float(f"{process_duration:.2f}")
        }

    except Exception as e:
        logger.error(f"Error in process_transcription: {e}")
        raise

async def process_template_field_old(
    transcript_text: str,
    field: TemplateField,
    patient_context: Dict[str, str]
) -> TemplateResponse:
    """
    Process a single template field using the specified prompts and format.

    Args:
        transcript_text (str): The transcribed text.
        field (TemplateField): The field to process.
        patient_context (Dict[str, str]): Patient context.

    Returns:
        TemplateResponse: The processed field content.
    """
    try:
        config = config_manager.get_config()
        client = AsyncOllamaClient(host=config["OLLAMA_BASE_URL"])
        options = config_manager.get_prompts_and_options()["options"]["general"]

        # Build request body with system and user messages
        request_body = [
            {"role": "system", "content": field.system_prompt},
            {"role": "system", "content": _build_patient_context(patient_context)},
            {"role": "user", "content": transcript_text},
            {"role": "assistant", "content": field.initial_prompt}
        ]

        response = await client.chat(
            model=config["PRIMARY_MODEL"],
            messages=request_body,
            format=field.format_schema if field.format_schema else None,
            options=options
        )

        # Get the part after the last linebreak in initial_prompt (if any)
        prefix_to_prepend = field.initial_prompt.split('\n')[-1] if '\n' in field.initial_prompt else ''

        # Prepend the prefix only if it exists
        full_content = f"{prefix_to_prepend} {response['message']['content']}" if prefix_to_prepend else response['message']['content']

        return TemplateResponse(
            field_key=field.field_key,
            content=full_content
        )
    except Exception as e:
        logger.error(f"Error processing template field {field.field_key}: {e}")
        raise

async def process_template_field(
    transcript_text: str,
    field: TemplateField,
    patient_context: Dict[str, str]
) -> TemplateResponse:
    """Process a single template field by extracting key points from the transcript text using a structured JSON output.

    This function sends the transcript text and patient context to the Ollama model, instructing it to return key points in JSON format according to the FieldResponse schema. The key points are then formatted into a human-friendly string.

    Args:
        transcript_text (str): The transcribed text to be analyzed.
        field (TemplateField): The template field configuration containing prompts.
        patient_context (Dict[str, str]): Patient context details.

    Returns:
        TemplateResponse: An object containing the field key and the formatted key points.

    Raises:
        Exception: Propagates exceptions if the extraction or formatting fails.
    """
    try:
        config = config_manager.get_config()
        client = AsyncOllamaClient(host=config["OLLAMA_BASE_URL"])
        options = config_manager.get_prompts_and_options()["options"]["general"]

        response_format = FieldResponse.model_json_schema()

        request_body = [
            {"role": "system", "content": (
                f"{field.system_prompt}\n"
                "Extract and return key points as a JSON array."
            )},
            {"role": "system", "content": _build_patient_context(patient_context)},
            {"role": "user", "content": transcript_text},
        ]

        response = await client.chat(
            model=config["PRIMARY_MODEL"],
            messages=request_body,
            format=response_format,
            options={**options, "temperature": 0}
        )
        print(response)
        # Parse the response
        field_response = FieldResponse.model_validate_json(
            response['message']['content']
        )

        # Convert key points into a nicely formatted string
        formatted_content = "\n".join(f"• {point.strip()}" for point in field_response.key_points)
        print(formatted_content)
        return TemplateResponse(
            field_key=field.field_key,
            content=formatted_content
        )

    except Exception as e:
        logger.error(f"Error processing template field {field.field_key}: {e}")
        raise

# Helps to clean up double spaces
def clean_list_spacing(text: str) -> str:
    """Clean up extra spaces in list items and at line start."""
    # Fix numbered list items (e.g., "1.  text" -> "1. text")
    text = re.sub(r'(\d+\.)  +', r'\1 ', text)
    # Fix bullet points/dashes (e.g., "-  text" -> "- text")
    text = re.sub(r'([-•*])  +', r'\1 ', text)
    # Fix any double spaces at the start of lines
    text = re.sub(r'^\s{2,}', ' ', text)
    return text.strip()

async def refine_field_content(
    content: Union[str, Dict],
    field: TemplateField
) -> Union[str, Dict]:
    """
    Refine the content of a single field.

    Args:
        content (Union[str, Dict]): The raw content to refine.
        field (TemplateField): The field being processed.

    Returns:
        Union[str, Dict]: The refined content.
    """
    try:
        # If content is already structured (dict), return as is
        if isinstance(content, dict):
            return content

        config = config_manager.get_config()
        client = AsyncOllamaClient(host=config["OLLAMA_BASE_URL"])
        prompts = config_manager.get_prompts_and_options()
        options = prompts["options"]["general"]

        request_body = [
            {"role": "system", "content": prompts["prompts"]["refinement"]["system"]},
            {"role": "user", "content": content},
            {"role": "assistant", "content": field.initial_prompt}
        ]

        response = await client.chat(
            model=config["PRIMARY_MODEL"],
            messages=request_body,
            format=field.format_schema if field.format_schema else None,
            options=options
        )

        # Get the part after the last linebreak in initial_prompt (if any)
        prefix_to_prepend = field.initial_prompt.split('\n')[-1] if '\n' in field.initial_prompt else ''

        # Prepend the prefix only if it exists
        full_content = f"{prefix_to_prepend} {response['message']['content']}" if prefix_to_prepend else response['message']['content']

        # Clean the double spaces
        cleaned_content = clean_list_spacing(full_content)

        return cleaned_content
    except Exception as e:
        logger.error(f"Error refining field {field.field_key}: {e}")
        raise

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

async def process_template(
    transcript_text: str,
    template_fields: List[TemplateField],
    patient_context: Dict[str, str]
) -> Dict[str, Union[str, float]]:
    """
    Process all fields in a template concurrently.

    Args:
        transcript_text (str): The transcribed text.
        template_fields (List[TemplateField]): The fields to process.
        patient_context (Dict[str, str]): Patient context.

    Returns:
        dict: A dictionary containing:
            - 'fields' (Dict[str, str]): Processed field data.
            - 'process_duration' (float): The time taken for processing.
    """
    process_start = time.perf_counter()

    try:
        # Process all fields concurrently
        raw_results = await asyncio.gather(*[
            process_template_field(
                transcript_text,
                field,
                patient_context
            )
            for field in template_fields
        ])

        # Refine all results concurrently
        refined_results = await asyncio.gather(*[
            refine_field_content(
                result.content,
                field
            )
            for result, field in zip(raw_results, template_fields)
        ])

        # Combine results into a dictionary
        processed_fields = {
            field.field_key: refined_content
            for field, refined_content in zip(template_fields, refined_results)
        }

        process_duration = time.perf_counter() - process_start

        return {
            "fields": processed_fields,
            "process_duration": process_duration
        }
    except Exception as e:
        logger.error(f"Error in process_template: {e}")
        raise
