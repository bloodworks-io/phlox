"""Tests for streaming capture sessions: intake, warming, and routes."""

import asyncio
import time
from types import SimpleNamespace
from typing import Any
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api import transcribe as transcribe_router
from server.transcription import capture as capture_module
from server.transcription.capture import CaptureSession, capture_manager
from server.utils.current_user import CurrentUser, get_current_user, set_current_user

app = FastAPI()
app.include_router(transcribe_router.router, prefix="/api/transcribe")
client = TestClient(app)


def _fake_request(user="local"):
    return SimpleNamespace(state=SimpleNamespace(user=user))


def _make_session(**overrides: Any):
    from server.schemas.templates import TemplateField

    template_fields = [
        TemplateField(
            field_key="clinical_history",
            field_name="Current History",
            field_type="text",
            system_prompt="Extract the history.",
            style_example="• The history",
        ),
        TemplateField(
            field_key="plan",
            field_name="Plan",
            field_type="text",
            system_prompt="Extract the plan.",
            style_example="• The plan",
        ),
    ]
    defaults: dict[str, Any] = {
        "id": "cap-test",
        "owner_user": CurrentUser(1, "local", "admin"),
        "mode": "ambient",
        "template_key": "phlox_01",
        "template_fields": template_fields,
        "patient_context": {"name": "Test Patient", "dob": None, "gender": None},
        "primary_condition": None,
    }
    defaults.update(overrides)
    return CaptureSession(**defaults)


class _StaticSpeakers:
    def __init__(self, labels):
        self._labels = list(labels)

    def assign(self, _audio_bytes):
        return self._labels.pop(0) if self._labels else None


@pytest.fixture(autouse=True)
def clean_capture_sessions():
    capture_manager._sessions.clear()
    yield
    capture_manager._sessions.clear()


@pytest.fixture(autouse=True)
def router_identity(request, monkeypatch):
    """Bind the implicit local admin on the bare (middleware-less) test app.

    Tests marked ``no_default_user`` opt out to exercise the 401 path.
    """
    if "no_default_user" in request.keywords:
        return
    monkeypatch.setattr(
        "server.api.transcribe.get_current_user",
        lambda: CurrentUser(1, "local", "admin"),
    )


def _local_config(extra=None):
    config = {"LLM_PROVIDER": "local"}
    if extra:
        config.update(extra)
    return config


# ----------------------------------------------------------------- toggles


def test_streaming_capture_defaults_to_provider(monkeypatch):
    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config", lambda: {"LLM_PROVIDER": "local"}
    )
    assert capture_module.streaming_capture_enabled() is True

    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: {"LLM_PROVIDER": "openai"},
    )
    assert capture_module.streaming_capture_enabled() is False


def test_streaming_capture_explicit_setting_wins(monkeypatch):
    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: _local_config({"STREAMING_CAPTURE_ENABLED": False}),
    )
    assert capture_module.streaming_capture_enabled() is False

    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: {"LLM_PROVIDER": "openai", "STREAMING_CAPTURE_ENABLED": True},
    )
    assert capture_module.streaming_capture_enabled() is True


def test_kv_warming_toggle_overrides_provider_default(monkeypatch):
    # Default: only the bundled local provider warms.
    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config", lambda: _local_config()
    )
    assert capture_module.kv_warming_enabled() is True

    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: {"LLM_PROVIDER": "openai"},
    )
    assert capture_module.kv_warming_enabled() is False

    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: {"LLM_PROVIDER": "openai", "KV_WARMING_ENABLED": True},
    )
    assert capture_module.kv_warming_enabled() is True

    # ...and can force it off for the bundled provider too.
    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: _local_config({"KV_WARMING_ENABLED": False}),
    )
    assert capture_module.kv_warming_enabled() is False


# --------------------------------------------------------------- intake


@pytest.mark.asyncio
async def test_intake_returns_stt_duration(monkeypatch):
    from server.transcription import intake as intake_module

    async def fake_transcribe(_audio, **_kwargs):
        return {"text": "  hello  ", "transcriptionDuration": 0.42}

    monkeypatch.setattr(intake_module, "transcribe_audio", fake_transcribe)
    speaker, text, duration = await intake_module.intake_utterance(b"RIFF", None)
    assert (speaker, text) == (None, "hello")
    assert duration == pytest.approx(0.42)


@pytest.mark.asyncio
async def test_intake_defaults_missing_duration_to_zero(monkeypatch):
    from server.transcription import intake as intake_module

    async def fake_transcribe(_audio, **_kwargs):
        return {"text": "hello"}

    monkeypatch.setattr(intake_module, "transcribe_audio", fake_transcribe)
    _speaker, _text, duration = await intake_module.intake_utterance(b"RIFF", None)
    assert duration == 0.0


@pytest.mark.asyncio
async def test_handle_audio_ambient_labels_segment(monkeypatch):
    session = _make_session()
    session.speakers = _StaticSpeakers(["S1"])

    async def fake_intake(_audio, _speakers):
        return "S1", "the pain is worse on exertion", 0.35

    monkeypatch.setattr(capture_module, "intake_utterance", fake_intake)
    await capture_module.handle_audio(session, b"RIFF....")

    assert session.transcript_segments == ["S1: the pain is worse on exertion"]
    assert session.words_since_warm == 6
    assert session.failed_segments == 0
    assert session.stt_seconds == pytest.approx(0.35)


@pytest.mark.asyncio
async def test_handle_audio_dictate_stores_plain_text(monkeypatch):
    session = _make_session(mode="dictate")
    assert session.speakers is None

    async def fake_intake(_audio, speakers):
        assert speakers is None
        return None, "plain dictation", 0.2

    monkeypatch.setattr(capture_module, "intake_utterance", fake_intake)
    await capture_module.handle_audio(session, b"RIFF....")

    assert session.transcript_segments == ["plain dictation"]


@pytest.mark.asyncio
async def test_handle_audio_failure_counts_and_skips(monkeypatch):
    session = _make_session()

    async def failing_intake(_audio, _speakers):
        raise RuntimeError("stt down")

    monkeypatch.setattr(capture_module, "intake_utterance", failing_intake)
    await capture_module.handle_audio(session, b"RIFF....")

    assert session.transcript_segments == []
    assert session.failed_segments == 1


@pytest.mark.asyncio
async def test_handle_audio_empty_text_skips(monkeypatch):
    session = _make_session()

    async def fake_intake(_audio, _speakers):
        return None, "   ", 0.0

    monkeypatch.setattr(capture_module, "intake_utterance", fake_intake)
    await capture_module.handle_audio(session, b"RIFF....")

    assert session.transcript_segments == []


@pytest.mark.asyncio
async def test_handle_audio_ignores_ended_session(monkeypatch):
    session = _make_session()
    session.end()

    called = False

    async def fake_intake(_audio, _speakers):
        nonlocal called
        called = True
        return None, "text", 0.1

    monkeypatch.setattr(capture_module, "intake_utterance", fake_intake)
    await capture_module.handle_audio(session, b"RIFF....")
    assert called is False


@pytest.mark.asyncio
async def test_handle_audio_rebinds_owner_identity(monkeypatch):
    alice = CurrentUser(2, "alice", "clinician")
    session = _make_session(owner_user=alice)
    captured = {}

    async def fake_intake(_audio, _speakers):
        captured["user"] = get_current_user()
        return None, "text", 0.1

    monkeypatch.setattr(capture_module, "intake_utterance", fake_intake)
    set_current_user(None)
    try:
        await capture_module.handle_audio(session, b"RIFF....")
    finally:
        set_current_user(None)

    assert captured["user"] is alice


# --------------------------------------------------------------- warming

# Mini chat-template pieces for the raw warm-path tests. The strip target
# is terminator + generation header ("tail").
_TAIL = "<|im_end|>\n<|im_start|>assistant\n"


class _WarmFakeClient:
    """LLM client stub: identity language directive + captured chat calls."""

    def __init__(self, directive=""):
        self.directive = directive
        self.chats = []

    def _with_language_directive(self, messages):
        if not self.directive:
            return messages
        merged = {
            **messages[0],
            "content": f"{self.directive}\n\n{messages[0]['content']}",
        }
        return [merged, *messages[1:]]

    async def chat(self, **kwargs):
        self.chats.append(kwargs)
        return {"message": {"content": "x"}}


def _mock_warm_prompt(monkeypatch, tail=_TAIL, rendered=None):
    """Mock the native warm endpoints; returns a per-call recording dict."""
    calls = {"derive": [], "render": [], "prefill": []}

    async def fake_derive(system_content, _timeout):
        calls["derive"].append(system_content)
        return tail

    async def fake_render(messages, _timeout):
        calls["render"].append(messages)
        user = messages[1]["content"]
        return rendered if rendered is not None else (f"<|im_start|>user\n{user}{_TAIL}")

    async def fake_prefill(prompt, _timeout):
        calls["prefill"].append(prompt)

    from server.transcription import warm_prompt as warm_prompt_module

    monkeypatch.setattr(warm_prompt_module, "derive_generation_tail", fake_derive)
    monkeypatch.setattr(warm_prompt_module, "render_prompt", fake_render)
    monkeypatch.setattr(warm_prompt_module, "prefill", fake_prefill)
    return calls


@pytest.mark.asyncio
async def test_warm_raw_prompt_strips_tail_and_chains_strict_prefix(monkeypatch):
    """Raw warms must be strict prefixes of each other, header stripped —
    that is what lets llama.cpp resume above the old checkpoint pin."""
    session = _make_session()
    session.transcript_segments = ["S1: hello there"]
    session.words_since_warm = capture_module.WARM_MIN_WORDS

    client = _WarmFakeClient(directive="DIRECTIVE")
    calls = _mock_warm_prompt(monkeypatch)

    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: _local_config({"PRIMARY_MODEL": "test-model"}),
    )
    monkeypatch.setattr("server.llm_client.client.get_llm_client", lambda **_kwargs: client)

    await capture_module._warm(session)

    # Transcript grows; warm again.
    session.transcript_segments.append("S2: general kenobi")
    session.words_since_warm = capture_module.WARM_MIN_WORDS
    await capture_module._warm(session)

    assert len(calls["prefill"]) == 2
    first, second = calls["prefill"]
    assert second.startswith(first)  # strict-prefix chain
    assert not first.endswith(_TAIL) and not second.endswith(_TAIL)
    assert _TAIL in first + _TAIL  # sanity: header really was the suffix

    # Header derived once per session, reused on the second warm.
    assert len(calls["derive"]) == 1

    # The rendered messages carry the same language directive the chat
    # extraction call would apply — byte-identity of the shared prefix.
    rendered_system = calls["render"][0][0]["content"]
    assert rendered_system.startswith("DIRECTIVE\n\n")

    # The chat endpoint was never used on the local raw path.
    assert client.chats == []


@pytest.mark.asyncio
async def test_warm_raw_transient_error_does_not_degrade(monkeypatch):
    session = _make_session()
    session.transcript_segments = ["S1: hello"]
    client = _WarmFakeClient()
    calls = _mock_warm_prompt(monkeypatch)

    async def failing_render(_messages, _timeout):
        raise RuntimeError("llama restarting")

    from server.transcription import warm_prompt as warm_prompt_module

    monkeypatch.setattr(warm_prompt_module, "render_prompt", failing_render)
    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: _local_config({"PRIMARY_MODEL": "test-model"}),
    )
    monkeypatch.setattr("server.llm_client.client.get_llm_client", lambda **_kwargs: client)

    await capture_module._warm(session)  # swallowed

    assert session.warm_raw_degraded is False
    assert calls["prefill"] == []
    assert client.chats == []  # transient failure skips the warm entirely

    # Next warm retries raw and succeeds (header already derived).
    monkeypatch.setattr(warm_prompt_module, "render_prompt", _mock_render_ok())
    await capture_module._warm(session)
    assert len(calls["prefill"]) == 1
    assert session.warm_raw_degraded is False


def _mock_render_ok():
    async def render_ok(messages, _timeout):
        user = messages[1]["content"]
        return f"<|im_start|>user\n{user}<|im_end|>\n{_TAIL}"

    return render_ok


@pytest.mark.asyncio
async def test_warm_degrades_when_template_has_no_tail(monkeypatch):
    session = _make_session()
    client = _WarmFakeClient()
    _mock_warm_prompt(monkeypatch, tail=None)

    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: _local_config({"PRIMARY_MODEL": "test-model"}),
    )
    monkeypatch.setattr("server.llm_client.client.get_llm_client", lambda **_kwargs: client)

    await capture_module._warm(session)

    assert session.warm_raw_degraded is True
    # Fell back to a chat warm for this session.
    assert len(client.chats) == 1
    assert client.chats[0]["options"]["extra_body"] == {"cache_prompt": True}


@pytest.mark.asyncio
async def test_warm_degrades_when_strip_mismatches(monkeypatch):
    session = _make_session()
    client = _WarmFakeClient()
    calls = _mock_warm_prompt(monkeypatch, tail=_TAIL, rendered="no suffix match")

    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: _local_config({"PRIMARY_MODEL": "test-model"}),
    )
    monkeypatch.setattr("server.llm_client.client.get_llm_client", lambda **_kwargs: client)

    await capture_module._warm(session)

    assert session.warm_raw_degraded is True
    assert session.warm_tail is None
    assert len(client.chats) == 1

    # Permanently degraded: the second warm goes straight to chat.
    await capture_module._warm(session)
    assert len(client.chats) == 2
    assert len(calls["derive"]) == 1


@pytest.mark.asyncio
async def test_warm_chat_fallback_byte_identical_to_extraction(monkeypatch):
    """Degraded chat warms must serialise exactly like the real extraction call."""
    from server.schemas.templates import TemplateField
    from server.transcription.text import build_extraction_messages

    # A persistent field: dropped by process_transcription's filter — the
    # warm must drop it too or the KV prefix dies at the FIELDS block.
    session = _make_session(
        template_fields=[
            TemplateField(
                field_key="clinical_history",
                field_name="Current History",
                field_type="text",
                system_prompt="Extract the history.",
                style_example="• The history",
            ),
            TemplateField(
                field_key="plan",
                field_name="Plan",
                field_type="text",
                system_prompt="Extract the plan.",
                style_example="• The plan",
            ),
            TemplateField(
                field_key="medications",
                field_name="Medications",
                field_type="text",
                system_prompt="PERSISTENT-ONLY INSTRUCTIONS.",
                style_example="• The meds",
                persistent=True,
            ),
        ]
    )
    session.transcript_segments = ["S1: hello there", "S2: general kenobi"]
    session.warm_raw_degraded = True  # force the chat path
    client = _WarmFakeClient()

    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: _local_config({"PRIMARY_MODEL": "test-model"}),
    )
    monkeypatch.setattr("server.llm_client.client.get_llm_client", lambda **_kwargs: client)

    await capture_module._warm(session)

    kwargs = client.chats[0]
    assert kwargs["model"] == "test-model"
    # Mirror of process_transcription's filter (non-persistent only).
    filtered_fields = [f for f in session.template_fields if not f.persistent]
    assert kwargs["messages"] == build_extraction_messages(
        session.transcript_text(),
        filtered_fields,
        session.patient_context,
        is_ambient=True,
        primary_condition=None,
    )
    # The persistent field's instructions must not leak into the warm prefix.
    warm_system = kwargs["messages"][0]["content"]
    assert "PERSISTENT-ONLY INSTRUCTIONS." not in warm_system
    assert "medications" not in warm_system
    # Prefill-only shape: one decode step, output discarded.
    assert kwargs["options"]["num_predict"] == 1
    assert kwargs["options"]["extra_body"]["cache_prompt"] is True
    # No grammar constraining the warm-up.
    assert "format" not in kwargs


@pytest.mark.asyncio
async def test_warm_scopes_cache_prompt_to_bundled_provider(monkeypatch):
    """cache_prompt is llama.cpp-only; sending it to vLLM etc. would 400
    and silently kill every warm under the toggle override."""
    session = _make_session()
    client = _WarmFakeClient()

    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: {"LLM_PROVIDER": "openai", "PRIMARY_MODEL": "vllm-model"},
    )
    monkeypatch.setattr("server.llm_client.client.get_llm_client", lambda **_kwargs: client)

    await capture_module._warm(session)

    assert client.chats[0]["options"].get("extra_body") is None


@pytest.mark.asyncio
async def test_warm_rebinds_owner_identity(monkeypatch):
    alice = CurrentUser(2, "alice", "clinician")
    session = _make_session(owner_user=alice)
    client = _WarmFakeClient()
    captured = {}

    async def capturing_prefill(_prompt, _timeout):
        captured["user"] = get_current_user()

    from server.transcription import warm_prompt as warm_prompt_module

    monkeypatch.setattr(warm_prompt_module, "prefill", capturing_prefill)
    _mock_warm_prompt(monkeypatch)
    monkeypatch.setattr(warm_prompt_module, "prefill", capturing_prefill)

    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config",
        lambda: _local_config({"PRIMARY_MODEL": "test-model"}),
    )
    monkeypatch.setattr("server.llm_client.client.get_llm_client", lambda **_kwargs: client)

    set_current_user(None)
    try:
        await capture_module._warm(session)
    finally:
        set_current_user(None)

    assert captured["user"] is alice


@pytest.mark.asyncio
async def test_warming_not_scheduled_below_word_threshold(monkeypatch):
    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config", lambda: _local_config()
    )
    session = _make_session()
    session.transcript_segments = ["S1: short"]
    session.words_since_warm = 3

    assert capture_module._warming_due(session) is False


@pytest.mark.asyncio
async def test_warming_skipped_when_transcript_too_large(monkeypatch):
    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config", lambda: _local_config()
    )
    session = _make_session()
    session.words_since_warm = capture_module.WARM_MIN_WORDS

    session.transcript_tokens = capture_module.WARM_MAX_TRANSCRIPT_TOKENS
    assert capture_module._warming_due(session) is True

    session.transcript_tokens = capture_module.WARM_MAX_TRANSCRIPT_TOKENS + 1
    assert capture_module._warming_due(session) is False


@pytest.mark.asyncio
async def test_handle_audio_accumulates_transcript_tokens(monkeypatch):
    session = _make_session()

    async def fake_intake(_audio, _speakers):
        return "S1", "one two three", 0.1

    counted = []

    def fake_count(text):
        counted.append(text)
        return 7

    monkeypatch.setattr(capture_module, "intake_utterance", fake_intake)
    monkeypatch.setattr(capture_module, "_count_tokens", fake_count)
    await capture_module.handle_audio(session, b"RIFF....")

    assert session.transcript_tokens == 7
    assert counted == ["S1: one two three"]


@pytest.mark.asyncio
async def test_schedule_warm_skips_when_one_in_flight(monkeypatch):
    session = _make_session()

    held = asyncio.Event()
    release = asyncio.Event()

    async def slow_warm(_session):
        held.set()
        await release.wait()

    monkeypatch.setattr(capture_module, "_warm", slow_warm)
    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config", lambda: _local_config()
    )

    session.words_since_warm = capture_module.WARM_MIN_WORDS
    capture_module._schedule_warm(session)
    await held.wait()

    # Second schedule attempt while the first is running: counter untouched.
    session.words_since_warm = capture_module.WARM_MIN_WORDS
    capture_module._schedule_warm(session)

    release.set()
    await session.warm_task
    assert session.words_since_warm == capture_module.WARM_MIN_WORDS


@pytest.mark.asyncio
async def test_handle_audio_schedules_warm_after_threshold(monkeypatch):
    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config", lambda: _local_config()
    )
    session = _make_session()

    async def fake_intake(_audio, _speakers):
        return None, "one two three four five", 0.4

    monkeypatch.setattr(capture_module, "intake_utterance", fake_intake)

    warmed = []

    async def fake_warm(_session):
        warmed.append(True)

    monkeypatch.setattr(capture_module, "_warm", fake_warm)

    session.words_since_warm = capture_module.WARM_MIN_WORDS - 5
    await capture_module.handle_audio(session, b"RIFF....")
    await asyncio.wait_for(session.warm_task, timeout=5)

    assert warmed == [True]
    assert session.words_since_warm == 0


# --------------------------------------------------------------- finalize


@pytest.mark.asyncio
async def test_finalize_runs_batch_pipeline(monkeypatch):
    session = _make_session(mode="dictate")
    session.transcript_segments = ["line one", "line two"]
    session.speakers = None
    session.stt_seconds = 0.32 + 0.28 + 0.22

    calls = {}

    async def fake_process(**kwargs):
        calls.update(
            transcript=kwargs["transcript_text"],
            is_ambient=kwargs["is_ambient"],
            fields=kwargs["template_fields"],
            primary=kwargs.get("primary_condition"),
        )
        return {"fields": {"plan": "ok"}, "process_duration": 1.5}

    monkeypatch.setattr("server.transcription.text.process_transcription", fake_process)

    result = await capture_module.finalize(session)

    assert calls["transcript"] == "line one\nline two"
    assert calls["is_ambient"] is False
    assert result["fields"] == {"plan": "ok"}
    assert result["rawTranscription"] == "line one\nline two"
    # Cumulative ASR seconds, not the batch wait of zero.
    assert result["transcriptionDuration"] == pytest.approx(0.82)
    assert result["processDuration"] == 1.5


@pytest.mark.asyncio
async def test_drain_waits_for_pending_tasks():
    session = _make_session()
    done = asyncio.Event()

    async def pending():
        await asyncio.sleep(0.01)
        done.set()

    session.track_task(asyncio.create_task(pending()))
    await capture_module.drain(session, timeout=5)
    assert done.is_set()


# ------------------------------------------------- warm_prompt (pure unit)


def test_common_prefix_len():
    from server.transcription import warm_prompt

    assert warm_prompt.common_prefix_len("abcXY", "abcZQ") == 3
    assert warm_prompt.common_prefix_len("", "abc") == 0
    assert warm_prompt.common_prefix_len("same", "same") == 4


def test_strip_generation_tail():
    from server.transcription import warm_prompt

    assert warm_prompt.strip_generation_tail("PROMPT<HDR>", "<HDR>") == "PROMPT"
    assert warm_prompt.strip_generation_tail("PROMPT-X", "<HDR>") is None


@pytest.mark.asyncio
async def test_derive_generation_tail_diffs_probes(monkeypatch):
    from server.transcription import warm_prompt

    # Realistic chatml-shaped renders. Probes differ only in the final
    # content char ("x" vs "xy"), so the shared prefix ends at the content
    # and the suffix of the first render is the full tail: turn terminator
    # + generation header. Both must be stripped — a terminator left
    # behind would be replaced by the next warm's transcript text.
    tail = "<|im_end|>\n<|im_start|>assistant\n"

    async def fake_render(messages, _timeout):
        user = messages[1]["content"]
        return f"<|im_start|>system\nSYS<|im_end|>\n<|im_start|>user\n{user}{tail}"

    monkeypatch.setattr(warm_prompt, "render_prompt", fake_render)
    assert await warm_prompt.derive_generation_tail("SYS", 1.0) == tail

    # Template without a generation tail -> None (degrade signal).
    async def tailless_render(_messages, _timeout):
        return "no tail here"

    monkeypatch.setattr(warm_prompt, "render_prompt", tailless_render)
    assert await warm_prompt.derive_generation_tail("SYS", 1.0) is None


def test_manager_prune_removes_old_ended_sessions():
    session = capture_manager.create(
        owner_user=CurrentUser(2, "alice", "clinician"),
        mode="ambient",
        template_key=None,
        template_fields=[],
        patient_context={},
    )
    session.end()
    session.ended_at = time.time() - 2 * 60 * 60
    assert capture_manager.get(session.id) is None


# ---------------------------------------------------------------- router


@pytest.mark.no_default_user
def test_start_capture_session_requires_identity():
    response = client.post("/api/transcribe/capture/sessions", json={"mode": "ambient"})
    assert response.status_code == 401


def test_start_capture_session_rejected_when_disabled(monkeypatch):
    monkeypatch.setattr("server.api.transcribe.streaming_capture_enabled", lambda: False)
    response = client.post("/api/transcribe/capture/sessions", json={"mode": "ambient"})
    assert response.status_code == 409


def test_start_capture_session_bad_mode():
    response = client.post("/api/transcribe/capture/sessions", json={"mode": "interview"})
    assert response.status_code == 422


def test_start_capture_session_creates_owned_session(monkeypatch):
    monkeypatch.setattr("server.api.transcribe.streaming_capture_enabled", lambda: True)
    response = client.post(
        "/api/transcribe/capture/sessions",
        json={"mode": "ambient", "templateKey": None, "name": "Doe, Jane"},
    )
    assert response.status_code == 200
    sid = response.json()["session_id"]
    session = capture_manager.get(sid)
    assert session is not None
    assert session.owner_user.username == "local"
    assert session.mode == "ambient"
    assert session.speakers is not None
    assert session.patient_context["name"] == "Jane Doe"


def test_start_capture_session_dictate_has_no_speakers(monkeypatch):
    monkeypatch.setattr("server.api.transcribe.streaming_capture_enabled", lambda: True)
    response = client.post("/api/transcribe/capture/sessions", json={"mode": "dictate"})
    session = capture_manager.get(response.json()["session_id"])
    assert session is not None
    assert session.speakers is None


def test_upload_audio_unknown_session_404():
    response = client.post(
        "/api/transcribe/capture/sessions/nope/audio",
        files={"file": ("segment.wav", b"RIFF", "audio/wav")},
    )
    assert response.status_code == 404


def test_upload_audio_ownership_enforced():
    session = capture_manager.create(
        owner_user=CurrentUser(2, "alice", "clinician"),
        mode="ambient",
        template_key=None,
        template_fields=[],
        patient_context={},
    )
    # "local" (router_identity) is not alice
    response = client.post(
        f"/api/transcribe/capture/sessions/{session.id}/audio",
        files={"file": ("segment.wav", b"RIFF", "audio/wav")},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_upload_audio_intakes_in_background(monkeypatch):
    session = capture_manager.create(
        owner_user=CurrentUser(1, "local", "admin"),
        mode="ambient",
        template_key=None,
        template_fields=[],
        patient_context={},
    )

    async def fake_intake(_audio, _speakers):
        return "S1", "uploaded text", 0.3

    monkeypatch.setattr(capture_module, "intake_utterance", fake_intake)
    monkeypatch.setattr(
        "server.transcription.capture.config_manager.get_config", lambda: _local_config()
    )

    response = client.post(
        f"/api/transcribe/capture/sessions/{session.id}/audio",
        files={"file": ("segment.wav", b"RIFF", "audio/wav")},
    )
    assert response.status_code == 200
    assert response.json() == {"accepted": True}

    await capture_module.drain(session, timeout=5)
    assert session.transcript_segments == ["S1: uploaded text"]


def test_stop_capture_session_fallback_when_empty():
    session = capture_manager.create(
        owner_user=CurrentUser(1, "local", "admin"),
        mode="ambient",
        template_key=None,
        template_fields=[],
        patient_context={},
    )
    response = client.post(f"/api/transcribe/capture/sessions/{session.id}/stop")
    assert response.status_code == 200
    body = response.json()
    assert body["fallback"] is True


def test_stop_capture_session_fallback_after_failures():
    session = capture_manager.create(
        owner_user=CurrentUser(1, "local", "admin"),
        mode="ambient",
        template_key=None,
        template_fields=[],
        patient_context={},
    )
    session.transcript_segments = ["S1: captured fine"]
    session.failed_segments = 2

    response = client.post(f"/api/transcribe/capture/sessions/{session.id}/stop")
    assert response.status_code == 200
    body = response.json()
    assert body["fallback"] is True
    assert "2 utterance(s)" in body["reason"]


def test_stop_capture_session_returns_fields(monkeypatch):
    session = capture_manager.create(
        owner_user=CurrentUser(1, "local", "admin"),
        mode="ambient",
        template_key=None,
        template_fields=[],
        patient_context={},
    )
    session.transcript_segments = ["S1: hello"]

    async def fake_finalize(_session):
        return {
            "fields": {"plan": "review"},
            "rawTranscription": "S1: hello",
            "transcriptionDuration": 0.0,
            "processDuration": 2.0,
        }

    monkeypatch.setattr(capture_module, "finalize", fake_finalize)

    response = client.post(f"/api/transcribe/capture/sessions/{session.id}/stop")
    assert response.status_code == 200
    body = response.json()
    assert body["fields"] == {"plan": "review"}
    assert body["rawTranscription"] == "S1: hello"
    assert body["session_id"] == session.id
    assert "fallback" not in body

    # Repeat stop returns the cached result, never reprocessing.
    again = client.post(f"/api/transcribe/capture/sessions/{session.id}/stop")
    assert again.json() == body


def test_stop_capture_session_unknown_404():
    response = client.post("/api/transcribe/capture/sessions/nope/stop")
    assert response.status_code == 404


# ------------------------------------------------------- middleware paths


def test_live_audio_chunk_matches_capture_uploads():
    from server.middleware import _is_live_audio_chunk

    assert _is_live_audio_chunk("/api/transcribe/capture/sessions/abc/audio")
    assert _is_live_audio_chunk("/api/agent-live/sessions/abc/audio")
    assert not _is_live_audio_chunk("/api/transcribe/capture/sessions/abc/stop")
    assert not _is_live_audio_chunk("/api/transcribe/audio")


def test_rate_limit_keys_prefer_capture_prefix(monkeypatch):
    from server.middleware import RateLimitMiddleware

    monkeypatch.setattr("server.constants.RATE_LIMIT_DESKTOP_MULTIPLIER", 1)
    middleware = RateLimitMiddleware(app=Mock())
    rate, _burst = middleware._get_limit_for_path("/api/transcribe/capture/sessions/abc/audio")
    assert rate == 120
    assert middleware._get_endpoint_key("/api/transcribe/capture/sessions/abc/audio") == (
        "/api/transcribe/capture"
    )
    rate, _burst = middleware._get_limit_for_path("/api/transcribe/audio")
    assert rate == 10
