import aiohttp
import asyncio
import time
import re
import logging
from typing import Dict, List, Union
from server.utils.llm_client import AsyncLLMClient, LLMProviderType, get_llm_client
from server.constants import add_thinking_to_schema
from server.database.config import config_manager
from server.utils.helpers import refine_field_content
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
        filename, content_type = _detect_audio_format(audio_buffer)
        async with aiohttp.ClientSession() as session:
            form_data = aiohttp.FormData()
            form_data.add_field(
                "file",
                audio_buffer,
                filename=filename,
                content_type=content_type,
            )
            form_data.add_field("model", config["WHISPER_MODEL"])
            form_data.add_field("language", "en")
            form_data.add_field("temperature", "0.1")
            form_data.add_field("vad_filter", "true")
            form_data.add_field("response_format", "verbose_json")
            form_data.add_field("timestamp_granularities[]", "segment")

            transcription_start = time.perf_counter()

            headers = {
                "Authorization": f"Bearer {config['WHISPER_KEY']}"
            }

            async with session.post(
                f"{config['WHISPER_BASE_URL']}/v1/audio/transcriptions",
                data=form_data,
                headers=headers
            ) as response:
                transcription_end = time.perf_counter()
                transcription_duration = transcription_end - transcription_start

                if response.status != 200:
                    error_text = await response.text()
                    raise ValueError(f"Transcription failed: {error_text}")

                try:
                    data = await response.json()
                except Exception as e:
                    raise ValueError(f"Failed to parse response: {e}")

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

                # Clean repetitive text patterns
                transcript_text = _clean_repetitive_text(transcript_text)

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

async def process_template_field(
    transcript_text: str,
    field: TemplateField,
    patient_context: Dict[str, str]
) -> TemplateResponse:
    """Process a single template field by extracting key points from the transcript text using a structured JSON output."""
    try:
        config = config_manager.get_config()
        options = config_manager.get_prompts_and_options()["options"]["general"]

        # Initialize the appropriate client based on config
        client = get_llm_client()

        base_schema = FieldResponse.model_json_schema()
        response_format = add_thinking_to_schema(base_schema, config["PRIMARY_MODEL"])

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

        # Extract content from response based on provider type
        content = response['message']['content']

        field_response = FieldResponse.model_validate_json(content)

        # Convert key points into a nicely formatted string
        formatted_content = "\n".join(f"• {point.strip()}" for point in field_response.key_points)

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

def _clean_repetitive_text(text: str) -> str:
    """
    Clean up repetitive text patterns that might appear in transcripts.

    Args:
        text (str): The text to clean

    Returns:
        str: Cleaned text
    """
    # Pattern to find repetitions of the same word/phrase 3+ times in succession
    pattern = r'(\b\w+[\s\w]*?\b)(\s+\1){3,}'

    # Replace with just two instances
    cleaned_text = re.sub(pattern, r'\1 \1', text)

    # If the text changed, recursively clean again (for nested repetitions)
    if cleaned_text != text:
        return _clean_repetitive_text(cleaned_text)

    return cleaned_text

def _detect_audio_format(audio_buffer):
    """
    Simple audio format detection based on file signatures (magic numbers).
    """
    # Check file signatures for common audio formats
    if audio_buffer.startswith(b'ID3') or audio_buffer.startswith(b'\xFF\xFB'):
        return "recording.mp3", "audio/mpeg"
    elif audio_buffer.startswith(b'RIFF') and b'WAVE' in audio_buffer[0:12]:
        return "recording.wav", "audio/wav"
    elif audio_buffer.startswith(b'OggS'):
        return "recording.ogg", "audio/ogg"
    elif audio_buffer.startswith(b'fLaC'):
        return "recording.flac", "audio/flac"
    elif b'ftyp' in audio_buffer[0:20]:  # M4A/MP4 format
        return "recording.m4a", "audio/mp4"
    # Default to WAV if we can't determine
    return "recording.wav", "audio/wav"
