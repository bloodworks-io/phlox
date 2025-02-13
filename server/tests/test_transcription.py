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
)

# A simple asynchronous test for transcribe_audio
@pytest.mark.asyncio
async def test_transcribe_audio_success():
    # Prepare a fake configuration and response for the HTTP request
    fake_config = {
        "WHISPER_BASE_URL": "http://fake-whisper/",
        "WHISPER_MODEL": "base",
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

        with patch("aiohttp.ClientSession.post", return_value=fake_post_context):
            result = await transcribe_audio(b"fake audio data")
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
