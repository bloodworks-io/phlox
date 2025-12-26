import logging
import re
import time
from typing import Dict, Union

import aiohttp

from server.database.config.manager import config_manager

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

            headers = {"Authorization": f"Bearer {config['WHISPER_KEY']}"}

            async with session.post(
                f"{config['WHISPER_BASE_URL']}/v1/audio/transcriptions",
                data=form_data,
                headers=headers,
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
                    transcript_text = "\n".join(
                        segment["text"].strip() for segment in data["segments"]
                    )
                else:
                    transcript_text = data["text"]

                # Clean repetitive text patterns
                transcript_text = _clean_repetitive_text(transcript_text)

                return {
                    "text": transcript_text,
                    "transcriptionDuration": float(
                        f"{transcription_duration:.2f}"
                    ),
                }
    except Exception as error:
        logger.error(f"Error in transcribe_audio function: {error}")
        raise

def _clean_repetitive_text(text: str) -> str:
    """
    Clean up repetitive text patterns that might appear in transcripts.

    Args:
        text (str): The text to clean

    Returns:
        str: Cleaned text
    """
    # Pattern to find repetitions of the same word/phrase 3+ times in succession
    pattern = r"(\b\w+[\s\w]*?\b)(\s+\1){3,}"

    # Replace with just two instances
    cleaned_text = re.sub(pattern, r"\1 \1", text)

    # If the text changed, recursively clean again (for nested repetitions)
    if cleaned_text != text:
        return _clean_repetitive_text(cleaned_text)

    return cleaned_text


def _detect_audio_format(audio_buffer):
    """
    Simple audio format detection based on file signatures (magic numbers).
    """
    # Check file signatures for common audio formats
    if audio_buffer.startswith(b"ID3") or audio_buffer.startswith(b"\xff\xfb"):
        return "recording.mp3", "audio/mpeg"
    elif audio_buffer.startswith(b"RIFF") and b"WAVE" in audio_buffer[0:12]:
        return "recording.wav", "audio/wav"
    elif audio_buffer.startswith(b"OggS"):
        return "recording.ogg", "audio/ogg"
    elif audio_buffer.startswith(b"fLaC"):
        return "recording.flac", "audio/flac"
    elif b"ftyp" in audio_buffer[0:20]:  # M4A/MP4 format
        return "recording.m4a", "audio/mp4"
    # Default to WAV if we can't determine
    return "recording.wav", "audio/wav"
