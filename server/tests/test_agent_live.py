"""Tests for the live scribe agent: sessions, tools, and router endpoints."""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.agent_live import router as agent_live_router
from server.agent_live.router import _current_owner, _get_owned_session
from server.agent_live.session import LiveSession, session_manager
from server.agent_live.tools import (
    _normalise_entry,
    _remove_sentences,
    _seed_marker,
    execute_live_tool,
    get_live_tools_definition,
)

app = FastAPI()
app.include_router(agent_live_router.router, prefix="/api/agent-live")
client = TestClient(app)


def _fake_request(user="local"):
    return SimpleNamespace(state=SimpleNamespace(user=user))


def _make_session(**overrides):
    template_fields = [
        {"field_key": "clinical_history", "field_name": "Current History"},
        {"field_key": "plan", "field_name": "Plan"},
    ]
    defaults = {
        "id": "sess-test",
        "owner": "local",
        "patient_context": {"name": "Test Patient"},
        "template_key": "phlox_01",
        "template_fields": template_fields,
    }
    defaults.update(overrides)
    return LiveSession(**defaults)


@pytest.fixture(autouse=True)
def clean_sessions():
    session_manager._sessions.clear()
    yield
    session_manager._sessions.clear()


# --------------------------------------------------------------------- tools


@pytest.mark.asyncio
async def test_get_note_fields_lists_state():
    session = _make_session()
    session.field_drafts = {"plan": "1. Book PET scan"}
    result = await execute_live_tool(session, "get_note_fields", {})
    assert "clinical_history" in result["content"]
    assert "1. Book PET scan" in result["content"]


@pytest.mark.asyncio
async def test_update_note_field_replaces_and_emits_event():
    session = _make_session()
    result = await execute_live_tool(
        session, "update_note_field", {"field_key": "plan", "content": "1. GP review"}
    )
    assert session.field_drafts["plan"] == "1. GP review"
    assert result["events"][0]["type"] == "field_update"
    assert result["events"][0]["field_key"] == "plan"


@pytest.mark.asyncio
async def test_update_note_field_rejects_clinician_edits_in_live_mode():
    session = _make_session()
    session.user_touched.add("plan")
    result = await execute_live_tool(
        session, "update_note_field", {"field_key": "plan", "content": "overwritten"}
    )
    assert session.field_drafts.get("plan") is None
    assert "clinician manually edited" in result["content"]

    # Tidy mode may edit clinician fields (explicit spoken direction).
    session.mode = "tidy"
    result = await execute_live_tool(
        session, "update_note_field", {"field_key": "plan", "content": "rewritten"}
    )
    assert session.field_drafts["plan"] == "rewritten"


@pytest.mark.asyncio
async def test_append_to_field_matches_marker_style():
    session = _make_session()
    session.field_drafts["plan"] = "1. Book PET scan\n2. Bloods"
    await execute_live_tool(
        session, "append_to_field", {"field_key": "plan", "entry": "GP review"}
    )
    assert session.field_drafts["plan"] == "1. Book PET scan\n2. Bloods\n3. GP review"

    session.field_drafts["clinical_history"] = "• Fatigue"
    await execute_live_tool(
        session, "append_to_field", {"field_key": "clinical_history", "entry": "Weight loss"}
    )
    assert session.field_drafts["clinical_history"] == "• Fatigue\n• Weight loss"


@pytest.mark.asyncio
async def test_remove_from_field_drops_matching_sentence():
    session = _make_session()
    session.field_drafts["clinical_history"] = (
        "• Fatigue for three months\n• Patient's dog died last week\n• Weight loss of 4kg"
    )
    result = await execute_live_tool(
        session, "remove_from_field", {"field_key": "clinical_history", "phrase": "dog died"}
    )
    content = session.field_drafts["clinical_history"]
    assert "dog" not in content
    assert "Fatigue" in content and "Weight loss" in content
    assert result["events"]


@pytest.mark.asyncio
async def test_remove_from_field_reports_no_match():
    session = _make_session()
    session.field_drafts["plan"] = "1. Book PET scan"
    result = await execute_live_tool(
        session, "remove_from_field", {"field_key": "plan", "phrase": "cat"}
    )
    assert "not found" in result["content"]
    assert session.field_drafts["plan"] == "1. Book PET scan"


@pytest.mark.asyncio
async def test_unknown_field_key_error():
    session = _make_session()
    result = await execute_live_tool(
        session, "update_note_field", {"field_key": "nope", "content": "x"}
    )
    assert "Unknown field_key 'nope'" in result["content"]


@pytest.mark.asyncio
async def test_stage_artifact_missing_template():
    session = _make_session()
    result = await execute_live_tool(
        session, "stage_artifact", {"template_id": "missing", "field_values": {}}
    )
    assert "not found" in result["content"]
    assert session.staged_artifacts == []


@pytest.mark.asyncio
async def test_get_jobs_hint_when_empty():
    session = _make_session()
    result = await execute_live_tool(session, "get_jobs", {})
    assert "wrap_up" in result["content"].lower()
    assert result["events"] == []


@pytest.mark.asyncio
async def test_set_jobs_replaces_list_and_emits():
    session = _make_session()
    session.staged_jobs = [
        {"text": "Email CDU", "checked": True},
        {"text": "Book MRI", "checked": True},
    ]
    result = await execute_live_tool(
        session,
        "set_jobs",
        {
            "jobs": [
                {"text": "Email CDU", "checked": True},
                {"text": "", "checked": True},  # dropped: empty
                {"checked": False},  # dropped: no text
                "not-a-dict",  # dropped: wrong shape
            ]
        },
    )
    assert session.staged_jobs == [{"text": "Email CDU", "checked": True}]
    assert result["events"] == [
        {"type": "jobs_staged", "jobs": [{"text": "Email CDU", "checked": True}]}
    ]

    listing = await execute_live_tool(session, "get_jobs", {})
    assert "Email CDU" in listing["content"]


@pytest.mark.asyncio
async def test_wrap_up_emits_request_event():
    session = _make_session()
    result = await execute_live_tool(session, "wrap_up", {})
    assert result["events"] == [{"type": "request_wrap_up"}]
    assert "Opening" in result["content"]


def test_remove_sentences_fuzzy_word_match():
    content = "M-protein is 15 g/L. The dog died last week, sadly. Stable overall."
    new, changed = _remove_sentences(content, "dog died")
    assert changed is True
    assert "dog" not in new
    assert "M-protein is 15 g/L." in new
    assert "Stable overall." in new


def test_remove_sentences_no_false_positive():
    content = "Discussed cardiovascular risk scores in detail."
    new, changed = _remove_sentences(content, "dog died")
    assert changed is False
    assert new == content


def test_normalise_entry_numbered_and_bulleted():
    assert _normalise_entry("1. Alpha\n2. Beta", "Gamma") == "\n3. Gamma"
    assert _normalise_entry("• Alpha", "Beta") == "\n• Beta"
    assert _normalise_entry("", "First") == "First"
    assert _normalise_entry("Prose ends here", "More") == "\nMore"


def _styled_session():
    """Session whose fields carry marker-led style examples."""
    return _make_session(
        template_fields=[
            {
                "field_key": "clinical_history",
                "field_name": "Current History",
                "style_example": "• Fatigue for 3 months\n• 4 kg weight loss",
            },
            {
                "field_key": "plan",
                "field_name": "Plan",
                "style_example": "1. Check CBC, LFTs in 2 weeks\n2. Refer to dermatology",
            },
        ]
    )


@pytest.mark.asyncio
async def test_append_to_empty_field_seeds_marker_from_style_example():
    session = _styled_session()
    await execute_live_tool(
        session, "append_to_field", {"field_key": "clinical_history", "entry": "Night sweats"}
    )
    assert session.field_drafts["clinical_history"] == "• Night sweats"


@pytest.mark.asyncio
async def test_append_to_bare_numbered_field_continues_numbering():
    session = _styled_session()
    session.field_drafts["plan"] = "Book PET scan\nBloods"
    await execute_live_tool(
        session, "append_to_field", {"field_key": "plan", "entry": "GP review"}
    )
    assert session.field_drafts["plan"] == "Book PET scan\nBloods\n3. GP review"


@pytest.mark.asyncio
async def test_update_note_field_applies_markers_to_bare_lines():
    session = _styled_session()
    await execute_live_tool(
        session,
        "update_note_field",
        {"field_key": "plan", "content": "Book PET scan\nBloods\n3. GP review"},
    )
    assert session.field_drafts["plan"] == "1. Book PET scan\n2. Bloods\n3. GP review"

    await execute_live_tool(
        session,
        "update_note_field",
        {"field_key": "clinical_history", "content": "Fatigue\nWeight loss"},
    )
    assert session.field_drafts["clinical_history"] == "• Fatigue\n• Weight loss"


@pytest.mark.asyncio
async def test_narrative_format_override_sticks():
    session = _styled_session()
    await execute_live_tool(
        session,
        "update_note_field",
        {
            "field_key": "clinical_history",
            "content": "Fatigue for three months with 4 kg weight loss.",
            "format": "narrative",
        },
    )
    assert session.field_drafts["clinical_history"] == (
        "Fatigue for three months with 4 kg weight loss."
    )

    # Later appends respect the override: plain sentence, no bullet.
    await execute_live_tool(
        session,
        "append_to_field",
        {"field_key": "clinical_history", "entry": "Reports night sweats also."},
    )
    assert session.field_drafts["clinical_history"] == (
        "Fatigue for three months with 4 kg weight loss.\nReports night sweats also."
    )


@pytest.mark.asyncio
async def test_list_format_override_beats_user_touched():
    session = _styled_session()
    session.user_touched.add("clinical_history")
    session.mode = "tidy"  # live mode refuses updates to clinician-edited fields
    await execute_live_tool(
        session,
        "update_note_field",
        {"field_key": "clinical_history", "content": "Fatigue\nWeight loss", "format": "list"},
    )
    assert session.field_drafts["clinical_history"] == "• Fatigue\n• Weight loss"


@pytest.mark.asyncio
async def test_append_to_clinician_prose_field_adds_no_marker():
    session = _styled_session()
    session.user_touched.add("clinical_history")
    session.field_drafts["clinical_history"] = "Fatigue for three months."
    await execute_live_tool(
        session, "append_to_field", {"field_key": "clinical_history", "entry": "Weight loss"}
    )
    assert session.field_drafts["clinical_history"] == (
        "Fatigue for three months.\nWeight loss"
    )


@pytest.mark.asyncio
async def test_remove_from_field_renumbers_plan():
    session = _styled_session()
    session.field_drafts["plan"] = "1. Book PET scan\n2. Email CDU\n3. Bloods"
    await execute_live_tool(
        session, "remove_from_field", {"field_key": "plan", "phrase": "CDU"}
    )
    assert session.field_drafts["plan"] == "1. Book PET scan\n2. Bloods"


def test_seed_marker_ignores_non_list_first_lines():
    assert _seed_marker({"style_example": "Exam:\n• Alert and oriented"}) is None
    assert _seed_marker({}) is None
    assert _seed_marker({"style_example": "1. Check CBC\n2. Refer"}) == "1."


def test_live_tool_definitions_shape():
    definitions = get_live_tools_definition()
    names = {t["function"]["name"] for t in definitions}
    assert names == {
        "get_note_fields",
        "update_note_field",
        "append_to_field",
        "remove_from_field",
        "stage_artifact",
        "get_jobs",
        "set_jobs",
        "wrap_up",
    }
    for tool in definitions:
        assert tool["type"] == "function"
        assert tool["function"]["strict"] is True


# ------------------------------------------------------------------ session


def test_session_manager_create_and_get():
    session = session_manager.create(
        owner="alice",
        patient_context={"name": "X"},
        template_key=None,
        template_fields=[],
        initial_fields={"plan": "carry me over"},
    )
    fetched = session_manager.get(session.id)
    assert fetched is session
    assert fetched.field_drafts == {"plan": "carry me over"}
    assert fetched.mode == "live"


def test_session_prune_removes_old_ended_sessions():
    import time

    session = session_manager.create(
        owner="alice", patient_context={}, template_key=None, template_fields=[]
    )
    session.end()
    session.ended_at = time.time() - 3600  # pretend it ended an hour ago
    assert session_manager.get(session.id) is None


def test_event_bus_drops_slow_consumers():
    import asyncio

    async def run():
        session = _make_session()
        queue = session.subscribe()
        # Fill the queue beyond its bound, then emit: no exception.
        for _ in range(250):
            await session.emit({"type": "agent_status", "content": "x"})
        session.unsubscribe(queue)

    asyncio.run(run())


# ------------------------------------------------------------------- router


def test_start_session_returns_id():
    response = client.post(
        "/api/agent-live/sessions",
        json={"patient": {"name": "Test"}, "template_key": "phlox_01"},
    )
    assert response.status_code == 200
    assert "session_id" in response.json()


def test_start_session_loads_template_fields():
    response = client.post(
        "/api/agent-live/sessions",
        json={"patient": {"name": "Test"}, "template_key": "phlox_01"},
    )
    session_id = response.json()["session_id"]
    session = session_manager.get(session_id)
    assert session.template_fields, "expected phlox_01 fields to be loaded"
    assert any(f.get("field_key") == "plan" for f in session.template_fields)


def test_audio_upload_accepted_with_mocked_engine():
    response = client.post(
        "/api/agent-live/sessions",
        json={"patient": {"name": "Test"}},
    )
    session_id = response.json()["session_id"]
    session = session_manager.get(session_id)
    session.engine.handle_audio = AsyncMock()

    audio = b"RIFF" + b"\x00" * 64
    response = client.post(
        f"/api/agent-live/sessions/{session_id}/audio",
        files={"file": ("segment.wav", audio, "audio/wav")},
    )
    assert response.status_code == 200
    assert response.json() == {"accepted": True}


def test_feedback_marks_clinician_edits():
    response = client.post(
        "/api/agent-live/sessions",
        json={
            "patient": {"name": "Test"},
            "template_key": "phlox_01",
            "template_data": {"plan": "1. Original"},
        },
    )
    session_id = response.json()["session_id"]

    response = client.post(
        f"/api/agent-live/sessions/{session_id}/feedback",
        json={"fields": {"plan": "1. Clinician rewrite", "bogus": "ignored"}},
    )
    assert response.status_code == 200

    session = session_manager.get(session_id)
    assert session.field_drafts["plan"] == "1. Clinician rewrite"
    assert "plan" in session.user_touched
    assert "bogus" not in session.field_drafts


def test_stop_session_replays_final_state():
    response = client.post(
        "/api/agent-live/sessions",
        json={"patient": {"name": "Test"}},
    )
    session_id = response.json()["session_id"]
    session = session_manager.get(session_id)
    session.engine.enter_tidy_mode = AsyncMock()
    session.transcript_segments.append("hello")

    response = client.post(f"/api/agent-live/sessions/{session_id}/stop")
    assert response.status_code == 200
    body = response.json()
    assert body["transcript"] == "hello"
    assert body["mode"] == "live"
    assert session_manager.get(session_id).is_ended


def test_events_stream_replays_and_ends():
    response = client.post(
        "/api/agent-live/sessions",
        json={"patient": {"name": "Test"}},
    )
    session_id = response.json()["session_id"]
    session = session_manager.get(session_id)
    session.engine.handle_audio = AsyncMock()
    session.transcript_segments.append("already spoken")
    session.field_drafts["plan"] = "1. Drafted"

    client.post(f"/api/agent-live/sessions/{session_id}/stop")

    response = client.get(f"/api/agent-live/sessions/{session_id}/events")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    payload = response.content.decode()
    assert '"type": "start"' in payload
    assert "already spoken" in payload
    assert '"field_state"' in payload
    assert '"type": "end"' in payload


def test_mode_switch_calls_engine():
    response = client.post(
        "/api/agent-live/sessions",
        json={"patient": {"name": "Test"}},
    )
    session_id = response.json()["session_id"]
    session = session_manager.get(session_id)
    session.engine.enter_tidy_mode = AsyncMock()

    response = client.post(
        f"/api/agent-live/sessions/{session_id}/mode", json={"mode": "tidy"}
    )
    assert response.status_code == 200
    session.engine.enter_tidy_mode.assert_awaited_once()


def test_push_jobs_seeds_staged_list():
    response = client.post(
        "/api/agent-live/sessions",
        json={"patient": {"name": "Test"}},
    )
    session_id = response.json()["session_id"]

    response = client.post(
        f"/api/agent-live/sessions/{session_id}/jobs",
        json={"jobs": [{"text": "Email CDU", "checked": True}]},
    )
    assert response.status_code == 200
    session = session_manager.get(session_id)
    assert session.staged_jobs == [{"text": "Email CDU", "checked": True}]

    # Final state includes the staged jobs.
    final = client.post(f"/api/agent-live/sessions/{session_id}/stop").json()
    assert final["jobs"] == [{"text": "Email CDU", "checked": True}]


def test_unknown_session_404():
    response = client.post(
        "/api/agent-live/sessions/deadbeef/stop",
    )
    assert response.status_code == 404


def test_ownership_enforced():
    session = _make_session(id="sess-alice", owner="alice")
    session_manager._sessions[session.id] = session

    with pytest.raises(Exception) as bob_error:
        _get_owned_session("sess-alice", _fake_request(user="bob"))
    assert getattr(bob_error.value, "status_code", None) == 403

    fetched = _get_owned_session("sess-alice", _fake_request(user="alice"))
    assert fetched is session


def test_current_owner_defaults_to_local():
    request = SimpleNamespace(state=SimpleNamespace())
    assert _current_owner(request) == "local"


# ------------------------------------------------------------------- engine


def test_parse_tool_call_json_and_dict_args():
    from server.agent_live.engine import _clean_tool_call, _parse_tool_call

    raw = {"id": "call_1", "function": {"name": "t", "arguments": '{"a": 1}'}}
    name, args, call_id = _parse_tool_call(raw)
    assert (name, args, call_id) == ("t", {"a": 1}, "call_1")

    cleaned = _clean_tool_call(raw)
    assert json.loads(cleaned["function"]["arguments"]) == {"a": 1}

    # Dict arguments are serialised for message history compatibility.
    dict_args = {"id": "call_2", "function": {"name": "t", "arguments": {"b": 2}}}
    cleaned = _clean_tool_call(dict_args)
    assert isinstance(cleaned["function"]["arguments"], str)


def test_unsupported_param_error_detection():
    from server.agent_live.engine import _is_unsupported_param_error

    class Fake400(Exception):
        status_code = 400

    class Fake500(Exception):
        status_code = 500

    assert (
        _is_unsupported_param_error(
            Fake400("Unsupported parameter: 'reasoning_effort' is not supported")
        )
        is True
    )
    assert _is_unsupported_param_error(Fake500("server exploded")) is False


@pytest.mark.asyncio
async def test_gate_classify_parses_verdict():
    from server.agent_live.engine import LiveAgentEngine

    session = _make_session()
    session.transcript_segments = ["how is the dog"]
    engine = LiveAgentEngine.__new__(LiveAgentEngine)  # skip __init__ (no client)
    engine.session = session
    engine._llm_client = None
    engine._chat = AsyncMock(return_value={"message": {"content": "ACT"}})

    assert await engine._gate_classify("calculate the risk score") == "ACT"
    engine._chat.assert_awaited_once()


@pytest.mark.asyncio
async def test_gate_classify_fails_closed_to_skip():
    from server.agent_live.engine import LiveAgentEngine

    session = _make_session()
    engine = LiveAgentEngine.__new__(LiveAgentEngine)
    engine.session = session
    engine._chat = AsyncMock(side_effect=RuntimeError("llm down"))

    assert await engine._gate_classify("anything") == "SKIP"


def test_live_system_prompt_contains_fields():
    from server.agent_live.prompts import build_live_system_prompt

    prompt = build_live_system_prompt(
        {"name": "Jane Doe", "dob": "1950-01-01"},
        [
            {
                "field_key": "plan",
                "field_name": "Plan",
                "system_prompt": "Numbered items.",
                "style_example": "1. Book PET scan\n2. GP review in 2 weeks",
                "refinement_rules": ["No full stops after numbers"],
                "adaptive_refinement_instructions": ["Uses 'review' not 'follow-up'"],
            }
        ],
    )
    assert "Jane Doe" in prompt
    assert "plan (Plan)" in prompt
    assert "Numbered items." in prompt
    # Style context is injected so live drafts match the clinician's voice.
    assert "1. Book PET scan" in prompt
    assert "style example" in prompt
    assert "No full stops after numbers" in prompt
    assert "learned style notes" in prompt
    assert "'review' not 'follow-up'" in prompt


def test_tidy_transition_mentions_jobs_and_rewording():
    from server.agent_live.prompts import build_tidy_transition_message

    message = build_tidy_transition_message()
    assert "just keep the 'email CDU' job" in message
    assert "make it tighter" in message
    assert "set_jobs" in message
