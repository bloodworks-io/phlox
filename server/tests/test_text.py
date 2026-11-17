"""Tests for the ambient pipeline: extraction + paired refine/ground coroutines."""

import json

import pytest

from server.schemas.templates import TemplateField
from server.transcription import text as text_module
from server.transcription.text import build_extraction_messages, process_transcription

TRANSCRIPT = "S1: tired all month\nS2: lets check bloods\nS1: no chest pain"
CONTEXT = {"name": "Test"}
OPTIONS = {"temperature": 0.7}
CONFIG = {"PRIMARY_MODEL": "test-model", "LLM_PROVIDER": "local"}
GROUNDING_PAYLOAD = {"lines": [{"line_index": 0, "sources": [0], "contradicts": []}]}


class _FakeClient:
    def __init__(self, payload=GROUNDING_PAYLOAD, error=None):
        self.payload = payload
        self.error = error
        self.calls = []

    async def chat_with_structured_output(self, model, messages, schema, options):
        self.calls.append({"model": model, "messages": messages, "options": options})
        if self.error:
            raise self.error
        return json.dumps(self.payload)


def _fields():
    return [
        TemplateField(
            field_key="clinical_history",
            field_name="Current History",
            field_type="text",
            system_prompt="extract history",
            style_example="• point",
        ),
        TemplateField(
            field_key="plan",
            field_name="Plan",
            field_type="text",
            system_prompt="extract plan",
            style_example="• point",
        ),
    ]


@pytest.fixture
def pipeline(monkeypatch):
    """Mock the LLM-dependent stages; returns hooks for per-test behaviour."""
    state = {"refined": {"clinical_history": "• Fatigue", "plan": "1. Bloods"}}

    async def fake_extract(transcript_text, fields, _ctx, _ambient, _primary):
        return {f.field_key: f"raw {f.field_key}" for f in fields}

    async def fake_refine(content, field, is_ambient=True):
        return state["refined"].get(field.field_key, "")

    monkeypatch.setattr(text_module, "process_all_fields_concurrently", fake_extract)
    monkeypatch.setattr(text_module, "refine_field_content", fake_refine)
    monkeypatch.setattr(text_module.config_manager, "get_config", lambda: CONFIG)
    monkeypatch.setattr(
        text_module.config_manager,
        "get_prompts_and_options",
        lambda: {"options": {"general": OPTIONS}},
    )
    return state


@pytest.mark.asyncio
async def test_process_transcription_returns_citations(pipeline, monkeypatch):
    fake_client = _FakeClient()
    monkeypatch.setattr(text_module, "get_llm_client", lambda: fake_client)

    result = await process_transcription(TRANSCRIPT, _fields(), CONTEXT)

    assert result["fields"] == {"clinical_history": "• Fatigue", "plan": "1. Bloods"}
    citations = result["citations"]
    assert set(citations) == {"clinical_history", "plan"}
    line = citations["clinical_history"][0]
    assert line["line_index"] == 0
    assert line["text"] == "• Fatigue"
    assert line["sources"] == [0]
    assert line["verdict"] == "supported"


@pytest.mark.asyncio
async def test_grounding_prefix_matches_extraction_messages(pipeline, monkeypatch):
    fake_client = _FakeClient()
    monkeypatch.setattr(text_module, "get_llm_client", lambda: fake_client)

    await process_transcription(TRANSCRIPT, _fields(), CONTEXT, is_ambient=False)

    expected = build_extraction_messages(TRANSCRIPT, _fields(), CONTEXT, False, None)
    assert fake_client.calls[0]["messages"][:2] == expected


@pytest.mark.asyncio
async def test_empty_refined_fields_are_placeholders_and_not_grounded(pipeline, monkeypatch):
    pipeline["refined"] = {"clinical_history": "• Fatigue", "plan": "  "}
    fake_client = _FakeClient()
    monkeypatch.setattr(text_module, "get_llm_client", lambda: fake_client)

    result = await process_transcription(TRANSCRIPT, _fields(), CONTEXT)

    assert result["fields"]["plan"] == "Nil documented"
    assert set(result["citations"]) == {"clinical_history"}


@pytest.mark.asyncio
async def test_grounding_setup_failure_degrades_to_no_citations(pipeline, monkeypatch):
    def broken_client():
        raise RuntimeError("no provider")

    monkeypatch.setattr(text_module, "get_llm_client", broken_client)

    result = await process_transcription(TRANSCRIPT, _fields(), CONTEXT)

    assert result["fields"] == {"clinical_history": "• Fatigue", "plan": "1. Bloods"}
    assert result["citations"] == {}


@pytest.mark.asyncio
async def test_grounding_call_failure_degrades_to_no_citations(pipeline, monkeypatch):
    monkeypatch.setattr(
        text_module, "get_llm_client", lambda: _FakeClient(error=RuntimeError("boom"))
    )

    result = await process_transcription(TRANSCRIPT, _fields(), CONTEXT)

    assert result["fields"] == {"clinical_history": "• Fatigue", "plan": "1. Bloods"}
    assert result["citations"] == {}
