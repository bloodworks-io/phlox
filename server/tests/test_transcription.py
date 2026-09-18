"""
Tests for transcription and transcription processing utilities.
We use pytest-asyncio to run async tests and patch external requests.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

# Import the public functions from the transcription module
from server.schemas.templates import TemplateField
from server.transcription import (
    _detect_audio_format,
    process_transcription,
    transcribe_audio,
)
from server.transcription.refinement import _format_numbered_list, refine_field_content
from server.transcription.text import _parse_field_summaries


# A simple asynchronous test for transcribe_audio
@pytest.mark.asyncio
async def test_transcribe_audio():
    fake_config = {
        "WHISPER_BASE_URL": "http://fake-whisper/",
        "WHISPER_MODEL": "whisper-1",
        "WHISPER_KEY": "fake-key",
        "LLM_PROVIDER": "external",
    }

    from server.database.config.manager import config_manager

    with patch.object(config_manager, "get_config", return_value=fake_config):
        # Build a fake httpx.Response
        fake_response = MagicMock(spec=httpx.Response)
        fake_response.status_code = 200
        fake_response.json.return_value = {"text": "Transcribed text"}
        fake_response.text = '{"text": "Transcribed text"}'

        # Build a mock AsyncClient whose post returns the fake response
        mock_client = AsyncMock()
        mock_client.post.return_value = fake_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("server.transcription.audio._detect_audio_format") as mock_detect,
            patch("httpx.AsyncClient", return_value=mock_client),
        ):
            mock_detect.return_value = ("recording.mp3", "audio/mpeg")

            result = await transcribe_audio(b"fake audio data")

            mock_detect.assert_called_once_with(b"fake audio data")
            assert "text" in result
            assert result["text"] == "Transcribed text"
            assert "transcriptionDuration" in result


# Test process_transcription with no non-persistent fields.
@pytest.mark.asyncio
async def test_process_transcription_no_fields():
    transcript_text = "This is a test transcript."
    template_fields = []  # no fields to process
    patient_context = {"name": "Doe, John", "dob": "1990-01-01", "gender": "M"}
    # Mock the LLM call layer since even empty fields triggers config/LLM access
    with patch("server.transcription.text.process_all_fields_concurrently", return_value={}):
        result = await process_transcription(transcript_text, template_fields, patient_context)  # ty: ignore
    # Expect fields dict to be empty, and process_duration present
    assert "fields" in result
    assert result["fields"] == {}
    assert "process_duration" in result
    assert isinstance(result["process_duration"], float)


# Test for the audio format detection function
def test_detect_audio_format():
    # Test MP3 detection
    mp3_data = b"ID3dummy data"
    filename, content_type = _detect_audio_format(mp3_data)
    assert filename == "recording.mp3"
    assert content_type == "audio/mpeg"

    # Test WAV detection
    wav_data = b"RIFFdummy WAVEdata"
    filename, content_type = _detect_audio_format(wav_data)
    assert filename == "recording.wav"
    assert content_type == "audio/wav"

    # Test OGG detection
    ogg_data = b"OggSdummy data"
    filename, content_type = _detect_audio_format(ogg_data)
    assert filename == "recording.ogg"
    assert content_type == "audio/ogg"

    # Test M4A detection
    m4a_data = b"dummyftypdata"
    filename, content_type = _detect_audio_format(m4a_data)
    assert filename == "recording.m4a"
    assert content_type == "audio/mp4"

    # Test unrecognized format (should default to WAV)
    unknown_data = b"unknown format data"
    filename, content_type = _detect_audio_format(unknown_data)
    assert filename == "recording.wav"
    assert content_type == "audio/wav"


# Test for API error handling with detailed error messages
@pytest.mark.asyncio
async def test_transcribe_audio_api_error():
    fake_config = {
        "WHISPER_BASE_URL": "http://fake-whisper/",
        "WHISPER_MODEL": "whisper-1",
        "WHISPER_KEY": "fake-key",
        "LLM_PROVIDER": "external",
    }

    from server.database.config.manager import config_manager

    with patch.object(config_manager, "get_config", return_value=fake_config):
        # Build a fake httpx.Response with an error status
        fake_response = MagicMock(spec=httpx.Response)
        fake_response.status_code = 400
        fake_response.text = '{"error": "Invalid request parameters"}'

        mock_client = AsyncMock()
        mock_client.post.return_value = fake_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("server.transcription.audio._detect_audio_format") as mock_detect,
            patch("httpx.AsyncClient", return_value=mock_client),
        ):
            mock_detect.return_value = ("recording.wav", "audio/wav")

            with pytest.raises(ValueError) as excinfo:
                await transcribe_audio(b"fake audio data")

            assert "Invalid request parameters" in str(excinfo.value)


# --- Small-model extraction parser (tolerant field_summaries handling) ---


def _make_field(**overrides):
    params = {
        "field_key": "current_history",
        "field_name": "Current History",
        "field_type": "text",
        "system_prompt": "Extract the history.",
        "style_example": "",
    }
    params.update(overrides)
    return TemplateField(**params)


def test_parse_field_summaries_wrapped():
    fields = [
        _make_field(),
        _make_field(field_key="plan", field_name="Plan"),
    ]
    content = json.dumps({"field_summaries": {"current_history": ["Hx one"], "plan": ["Plan one"]}})
    assert _parse_field_summaries(content, fields) == {
        "current_history": ["Hx one"],
        "plan": ["Plan one"],
    }


def test_parse_field_summaries_bare_mapping():
    fields = [_make_field()]
    assert _parse_field_summaries('{"current_history": ["Hx"]}', fields) == {
        "current_history": ["Hx"]
    }


def test_parse_field_summaries_double_wrapped():
    fields = [_make_field()]
    content = '{"field_summaries": {"field_summaries": {"current_history": ["Hx"]}}}'
    assert _parse_field_summaries(content, fields) == {"current_history": ["Hx"]}


def test_parse_field_summaries_field_name_keys():
    fields = [_make_field()]
    assert _parse_field_summaries('{"Current History": ["Hx"]}', fields) == {
        "current_history": ["Hx"]
    }


def test_parse_field_summaries_single_string_value():
    fields = [_make_field()]
    assert _parse_field_summaries('{"current_history": "Single point"}', fields) == {
        "current_history": ["Single point"]
    }


def test_parse_field_summaries_drops_junk_keys():
    fields = [_make_field()]
    summaries = _parse_field_summaries('{"junk": ["x"], "current_history": ["Hx"]}', fields)
    assert summaries == {"current_history": ["Hx"]}


def test_parse_field_summaries_surrounding_text():
    fields = [_make_field()]
    content = 'Sure! Here is the JSON:\n{"field_summaries": {"current_history": ["Hx"]}}\nDone.'
    assert _parse_field_summaries(content, fields) == {"current_history": ["Hx"]}


def test_parse_field_summaries_no_recognized_fields_raises():
    fields = [_make_field()]
    with pytest.raises(ValueError, match="no recognized fields"):
        _parse_field_summaries('{"unrelated": []}', fields)


def test_parse_field_summaries_empty_or_missing_json_raises():
    fields = [_make_field()]
    with pytest.raises(ValueError, match="empty extraction response"):
        _parse_field_summaries("", fields)
    with pytest.raises(ValueError, match="no JSON object"):
        _parse_field_summaries("no braces here", fields)


# --- Refinement empty-output guards ---


def _refine_mocks(response_json):
    config_manager = MagicMock()
    config_manager.get_config.return_value = {"PRIMARY_MODEL": "test-model"}
    config_manager.get_prompts_and_options.return_value = {
        "options": {"general": {}},
        "prompts": {"refinement": {"system": "Refine this."}},
    }
    client = MagicMock()
    client.chat_with_structured_output = AsyncMock(return_value=response_json)
    return config_manager, client


@pytest.mark.asyncio
async def test_refine_field_content_blank_input_skipped():
    field = _make_field()
    client = MagicMock()
    client.chat_with_structured_output = AsyncMock()
    with (
        patch("server.transcription.refinement.get_llm_client", return_value=client),
    ):
        result = await refine_field_content("   ", field)
    assert result == "   "
    client.chat_with_structured_output.assert_not_awaited()


@pytest.mark.asyncio
async def test_refine_field_content_dict_passthrough():
    field = _make_field()
    result = await refine_field_content({"structured": True}, field)
    assert result == {"structured": True}


@pytest.mark.asyncio
async def test_refine_field_content_empty_narrative_falls_back():
    field = _make_field(format_schema={"type": "narrative"})
    config_manager, client = _refine_mocks('{"narrative": ""}')
    with (
        patch("server.transcription.refinement.config_manager", config_manager),
        patch("server.transcription.refinement.get_llm_client", return_value=client),
    ):
        result = await refine_field_content("Original extracted content", field)
    assert result == "Original extracted content"
    assert client.chat_with_structured_output.await_count == 2  # retried once


@pytest.mark.asyncio
async def test_refine_field_content_empty_key_points_falls_back():
    field = _make_field(format_schema={"type": "bullet"})
    config_manager, client = _refine_mocks('{"key_points": []}')
    with (
        patch("server.transcription.refinement.config_manager", config_manager),
        patch("server.transcription.refinement.get_llm_client", return_value=client),
    ):
        result = await refine_field_content("• Original content", field)
    assert result == "• Original content"


@pytest.mark.asyncio
async def test_refine_field_content_filters_blank_points():
    field = _make_field(format_schema={"type": "bullet"})
    config_manager, client = _refine_mocks('{"key_points": ["point one", "", "   "]}')
    with (
        patch("server.transcription.refinement.config_manager", config_manager),
        patch("server.transcription.refinement.get_llm_client", return_value=client),
    ):
        result = await refine_field_content("• point one", field)
    assert result == "• Point one"


@pytest.mark.asyncio
async def test_refine_field_content_returns_refined_on_success():
    field = _make_field(format_schema={"type": "narrative"})
    config_manager, client = _refine_mocks('{"narrative": "Refined narrative."}')
    with (
        patch("server.transcription.refinement.config_manager", config_manager),
        patch("server.transcription.refinement.get_llm_client", return_value=client),
    ):
        result = await refine_field_content("raw content", field)
    assert result == "Refined narrative."
    assert client.chat_with_structured_output.await_count == 1


@pytest.mark.asyncio
async def test_refine_field_content_retry_adds_non_empty_instruction():
    field = _make_field(format_schema={"type": "narrative"})
    config_manager, client = _refine_mocks('{"narrative": ""}')
    client.chat_with_structured_output = AsyncMock(
        side_effect=['{"narrative": ""}', '{"narrative": "Recovered."}']
    )
    with (
        patch("server.transcription.refinement.config_manager", config_manager),
        patch("server.transcription.refinement.get_llm_client", return_value=client),
    ):
        result = await refine_field_content("raw content", field)
    assert result == "Recovered."

    calls = client.chat_with_structured_output.call_args_list
    assert len(calls) == 2
    first_prompt = calls[0].kwargs["messages"][0]["content"]
    second_prompt = calls[1].kwargs["messages"][0]["content"]
    assert "empty result" not in first_prompt
    assert "empty result" in second_prompt


@pytest.mark.asyncio
async def test_process_transcription_empty_field_gets_placeholder():
    from server.transcription.text import EMPTY_FIELD_PLACEHOLDER

    field = _make_field(field_key="clinical_history", persistent=False)
    with patch(
        "server.transcription.text.process_all_fields_concurrently",
        return_value={"clinical_history": ""},
    ):
        result = await process_transcription("transcript", [field], {})
    assert result["fields"]["clinical_history"] == EMPTY_FIELD_PLACEHOLDER


def test_format_numbered_list_skips_blank_points():
    assert _format_numbered_list(["First", "", "Third"]) == "1. First\n2. Third"
