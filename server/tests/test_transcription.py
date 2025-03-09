"""
Tests for transcription and transcription processing utilities.
We use pytest-asyncio to run async tests and patch external requests.
"""

import asyncio
import json
from unittest.mock import AsyncMock, patch
import pytest
from server.schemas.templates import TemplateField
from server.schemas.templates import TemplateResponse

# Import the public functions from your updated transcription module
from server.utils.transcription import (
    transcribe_audio,
    process_transcription,
    process_template_field,
    refine_field_content,
    _detect_audio_format,
)

# A simple asynchronous test for transcribe_audio
@pytest.mark.asyncio
async def test_transcribe_audio():
    # Prepare a fake configuration and response for the HTTP request
    fake_config = {
        "WHISPER_BASE_URL": "http://fake-whisper/",
        "WHISPER_MODEL": "whisper-1",
        "WHISPER_KEY": "fake-key",
    }

    # Patch config_manager.get_config() to return fake_config
    from server.database.config import config_manager
    with patch.object(config_manager, "get_config", return_value=fake_config):
        # Create a fake aiohttp response object
        fake_response = AsyncMock()
        fake_response.status = 200
        fake_response.json.return_value = {"text": "Transcribed text"}

        # Create a fake context manager for session.post that returns fake_response
        fake_post_context = AsyncMock()
        fake_post_context.__aenter__.return_value = fake_response

        # Mock the format detection function
        with patch("server.utils.transcription._detect_audio_format") as mock_detect:
            mock_detect.return_value = ("recording.mp3", "audio/mpeg")

            with patch("aiohttp.ClientSession.post", return_value=fake_post_context):
                result = await transcribe_audio(b"fake audio data")

                # Check that format detection was called
                mock_detect.assert_called_once_with(b"fake audio data")

                # Check the result
                assert "text" in result
                assert result["text"] == "Transcribed text"
                assert "transcriptionDuration" in result

# Test process_transcription with no non-persistent fields.
@pytest.mark.asyncio
async def test_process_transcription_no_fields():
    transcript_text = "This is a test transcript."
    template_fields = []  # no fields to process
    patient_context = {"name": "Doe, John", "dob": "1990-01-01", "gender": "M"}
    result = await process_transcription(transcript_text, template_fields, patient_context)
    # Expect fields dict to be empty, and process_duration present
    assert "fields" in result
    assert result["fields"] == {}
    assert "process_duration" in result
    assert isinstance(result["process_duration"], float)

# Test process_template_field and refine_field_content using dummy responses.
@pytest.mark.asyncio
async def test_template_field_processing_and_refinement(monkeypatch):
    field = TemplateField(
        field_key="test_field",
        field_name="Test Field",
        field_type="text",
        persistent=False,
        system_prompt="Extract key points as JSON.",
        initial_prompt="List items:",
        format_schema=None,
        refinement_rules=None,
    )

    async def fake_chat(*args, **kwargs):
        # Match the FieldResponse format
        return {
            "message": {
                "content": '{"key_points": ["Point one", "Point two"]}'
            }
        }

    monkeypatch.setattr(
        "server.utils.transcription.AsyncOllamaClient.chat",
        fake_chat
    )

    # Mock get_prompts_and_options
    def mock_get_prompts():
        return {
            "options": {"general": {}},
            "prompts": {
                "refinement": {
                    "system": "test",
                    "initial": "test"
                }
            }
        }
    monkeypatch.setattr(
        "server.database.config.config_manager.get_prompts_and_options",
        mock_get_prompts
    )

    # Mock the config manager
    def mock_get_config():
        return {
            "OLLAMA_BASE_URL": "http://mock",
            "PRIMARY_MODEL": "mock_model"
        }

    monkeypatch.setattr(
        "server.database.config.config_manager.get_config",
        mock_get_config
    )

    response = await process_template_field(
        "Test transcript",
        field,
        {"name": "Test", "dob": "2000-01-01", "gender": "M"}
    )

    assert isinstance(response, TemplateResponse)
    assert response.field_key == "test_field"

# Test for the audio format detection function
def test_detect_audio_format():
    # Test MP3 detection
    mp3_data = b'ID3dummy data'
    filename, content_type = _detect_audio_format(mp3_data)
    assert filename == 'recording.mp3'
    assert content_type == 'audio/mpeg'

    # Test WAV detection
    wav_data = b'RIFFdummy WAVEdata'
    filename, content_type = _detect_audio_format(wav_data)
    assert filename == 'recording.wav'
    assert content_type == 'audio/wav'

    # Test OGG detection
    ogg_data = b'OggSdummy data'
    filename, content_type = _detect_audio_format(ogg_data)
    assert filename == 'recording.ogg'
    assert content_type == 'audio/ogg'

    # Test M4A detection
    m4a_data = b'dummyftypdata'
    filename, content_type = _detect_audio_format(m4a_data)
    assert filename == 'recording.m4a'
    assert content_type == 'audio/mp4'

    # Test unrecognized format (should default to WAV)
    unknown_data = b'unknown format data'
    filename, content_type = _detect_audio_format(unknown_data)
    assert filename == 'recording.wav'
    assert content_type == 'audio/wav'

# Test for API error handling with detailed error messages
@pytest.mark.asyncio
async def test_transcribe_audio_api_error():
    # Prepare a fake configuration for the HTTP request
    fake_config = {
        "WHISPER_BASE_URL": "http://fake-whisper/",
        "WHISPER_MODEL": "whisper-1",
        "WHISPER_KEY": "fake-key",
    }

    # Patch config_manager.get_config() to return fake_config
    from server.database.config import config_manager
    with patch.object(config_manager, "get_config", return_value=fake_config):
        # Create a fake aiohttp response object with error
        fake_response = AsyncMock()
        fake_response.status = 400
        fake_response.text = AsyncMock(return_value='{"error": "Invalid request parameters"}')
        fake_response.json = AsyncMock(side_effect=ValueError("Invalid request parameters"))

        # Create a fake context manager for session.post that returns fake_response
        fake_post_context = AsyncMock()
        fake_post_context.__aenter__.return_value = fake_response

        # Mock the format detection function
        with patch("server.utils.transcription._detect_audio_format") as mock_detect:
            mock_detect.return_value = ("recording.wav", "audio/wav")

            with patch("aiohttp.ClientSession.post", return_value=fake_post_context):
                with pytest.raises(ValueError) as excinfo:
                    await transcribe_audio(b"fake audio data")

                # Check that the error message includes the API response
                assert "Invalid request parameters" in str(excinfo.value)
