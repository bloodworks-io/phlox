"""
Tests for central thinking control: param emission, capability learnings,
400 self-heal latch, and the chat thinking gate.
"""

import pytest

from server.database.config.manager import config_manager
from server.llm_client import thinking
from server.llm_client.client import AsyncLLMClient
from server.llm_client.providers.openai import _create_with_thinking_fallback

# ---------------------------------------------------------------- emission


def test_thinking_off_sends_both_params_to_selfhosted():
    params = thinking.build_thinking_params("off", "http://127.0.0.1:8123", "qwen")
    assert params == {
        "chat_template_kwargs": {"enable_thinking": False},
        "reasoning_effort": "none",
    }


def test_thinking_on_sends_only_template_kwarg():
    params = thinking.build_thinking_params("on", "http://127.0.0.1:8123", "qwen")
    assert params == {"chat_template_kwargs": {"enable_thinking": True}}


@pytest.mark.parametrize(
    "base_url",
    [
        "https://api.openai.com/v1",
        "https://my-deployment.openai.azure.com/openai/deployments/x",
        "https://openrouter.ai/api/v1",
    ],
)
def test_strict_hosts_only_get_reasoning_effort(base_url):
    assert thinking.is_strict_host(base_url)
    params = thinking.build_thinking_params("off", base_url, "m")
    assert params == {"reasoning_effort": "none"}
    assert thinking.build_thinking_params("on", base_url, "m") == {}


@pytest.mark.parametrize(
    "base_url", ["http://127.0.0.1:11434", "https://vllm.internal.example.com/v1"]
)
def test_selfhosted_hosts_are_not_strict(base_url):
    assert not thinking.is_strict_host(base_url)


def test_unknown_intent_emits_nothing():
    assert thinking.build_thinking_params(None, "http://x", "m") == {}
    assert thinking.build_thinking_params("bogus", "http://x", "m") == {}


# ------------------------------------------------- persisted learnings


def test_rejected_learning_drops_param():
    key = thinking.capability_key("http://127.0.0.1:8123", "qwen")
    config_manager.set_capability(key, {"thinking": {"rejected": ["chat_template_kwargs"]}})
    try:
        params = thinking.build_thinking_params("off", "http://127.0.0.1:8123", "qwen")
        assert "chat_template_kwargs" not in params
        assert params == {"reasoning_effort": "none"}
    finally:
        config_manager.set_capability(key, {})


def test_capability_rows_never_leak_into_get_config():
    key = thinking.capability_key("http://leak-test.example.com", "m")
    config_manager.set_capability(key, {"thinking": {"rejected": ["reasoning_effort"]}})
    try:
        assert config_manager.get_capability(key) == {
            "thinking": {"rejected": ["reasoning_effort"]}
        }
        # Reload from DB to prove the namespace exclusion holds.
        config_manager._load_configs()
        assert not any(k.startswith("CAPABILITY:") for k in config_manager.get_config())
        assert config_manager.get_capability(key) is not None
    finally:
        config_manager.set_capability(key, {})


def test_note_rejected_param_persists_unless_aggregator():
    assert thinking.note_rejected_param("http://127.0.0.1:8123", "qwen", "reasoning_effort")
    key = thinking.capability_key("http://127.0.0.1:8123", "qwen")
    try:
        assert "reasoning_effort" in config_manager.get_capability(key)["thinking"]["rejected"]
        # OpenRouter routes to varying downstreams: learnings are unstable.
        assert not thinking.note_rejected_param(
            "https://openrouter.ai/api/v1", "m", "chat_template_kwargs"
        )
        assert (
            config_manager.get_capability(
                thinking.capability_key("https://openrouter.ai/api/v1", "m")
            )
            is None
        )
    finally:
        config_manager.set_capability(key, {})


# --------------------------------------------------------- 400 latch


class _FakeBadRequest(Exception):
    status_code = 400


class _FakeCompletions:
    def __init__(self, calls):
        self._calls = calls

    async def create(self, **kwargs):
        self._calls.append(kwargs)
        if len(self._calls) == 1:
            raise _FakeBadRequest(
                "Error code: 400 - {'error': {'message': "
                "'Unrecognized request argument supplied: chat_template_kwargs', "
                "'type': 'invalid_request_error'}}"
            )
        return {"ok": True, **kwargs}


class _FakeChat:
    def __init__(self, completions):
        self.completions = completions


class _FakeOpenAI:
    def __init__(self):
        self.calls = []
        self.chat = _FakeChat(_FakeCompletions(self.calls))
        self.base_url = "http://127.0.0.1:8123/v1/"


@pytest.mark.asyncio
async def test_create_self_heals_once_on_rejected_param():
    fake = _FakeOpenAI()
    thinking_params = {
        "chat_template_kwargs": {"enable_thinking": False},
        "reasoning_effort": "none",
    }
    params = {"model": "qwen", "messages": []}

    result = await _create_with_thinking_fallback(fake, params, thinking_params)

    assert result["ok"] is True
    assert len(fake.calls) == 2
    assert "chat_template_kwargs" in fake.calls[0]
    assert "chat_template_kwargs" not in fake.calls[1]
    assert "reasoning_effort" in fake.calls[1]
    # Learning persisted for a stable endpoint.
    key = thinking.capability_key("http://127.0.0.1:8123/v1", "qwen")
    try:
        assert "chat_template_kwargs" in config_manager.get_capability(key)["thinking"]["rejected"]
    finally:
        config_manager.set_capability(key, {})


@pytest.mark.asyncio
async def test_create_does_not_swallow_other_400s():
    class _Boom:
        async def create(self, **_kwargs):
            raise _FakeBadRequest("Error code: 400 - {'error': {'message': 'bad model'}}")

    class _Chat:
        def __init__(self):
            self.completions = _Boom()

    class _FakeClient:
        def __init__(self):
            self.chat = _Chat()

    fake = _FakeClient()

    with pytest.raises(Exception, match="bad model"):
        await _create_with_thinking_fallback(fake, {"model": "m"}, {"reasoning_effort": "none"})


def test_rejected_param_from_error_parses_names():
    exc = Exception("Unrecognized request argument supplied: reasoning_effort")
    assert thinking.rejected_param_from_error(exc) == "reasoning_effort"
    assert thinking.rejected_param_from_error(Exception("totally unrelated")) is None


# ------------------------------------------------------- client wiring


@pytest.mark.asyncio
async def test_client_resolves_intent_and_strips_option(monkeypatch):
    captured = {}

    async def fake_provider(
        _client, _model, _messages, _fmt, options, _tools, _stream, thinking_params
    ):
        captured["options"] = options
        captured["thinking_params"] = thinking_params
        return {"sentinel": True}

    import server.llm_client.client as client_module

    monkeypatch.setattr(client_module, "openai_compatible_chat", fake_provider)
    llm = AsyncLLMClient(provider_type="openai", base_url="http://127.0.0.1:8123", api_key="k")
    await llm.chat(
        model="qwen",
        messages=[{"role": "user", "content": "hi"}],
        options={"temperature": 0.1, "thinking": "on"},
    )

    assert captured["options"] == {"temperature": 0.1}
    assert captured["thinking_params"] == {"chat_template_kwargs": {"enable_thinking": True}}


@pytest.mark.asyncio
async def test_client_defaults_to_thinking_off_without_intent(monkeypatch):
    captured = {}

    async def fake_provider(
        _client, _model, _messages, _fmt, _options, _tools, _stream, thinking_params
    ):
        captured.setdefault("calls", []).append(thinking_params)
        return {"sentinel": True}

    import server.llm_client.client as client_module

    monkeypatch.setattr(client_module, "openai_compatible_chat", fake_provider)
    llm = AsyncLLMClient(provider_type="openai", base_url="http://127.0.0.1:8123", api_key="k")
    await llm.chat(
        model="qwen",
        messages=[{"role": "user", "content": "hi"}],
        options={"temperature": 0.1},
    )
    llm_strict = AsyncLLMClient(
        provider_type="openai", base_url="https://api.openai.com/v1", api_key="k"
    )
    await llm_strict.chat(
        model="gpt-test",
        messages=[{"role": "user", "content": "hi"}],
        options={"temperature": 0.1},
    )

    selfhosted, strict = captured["calls"]
    # Self-hosted dialect: both disable params.
    assert selfhosted == {
        "chat_template_kwargs": {"enable_thinking": False},
        "reasoning_effort": "none",
    }
    # Strict hosts must get the OpenAI-dialect disable only.
    assert strict == {"reasoning_effort": "none"}


# ---------------------------------------------------- chat thinking gate


def _patch_gate(monkeypatch, provider, selected_model_id, primary_model=""):
    monkeypatch.setattr(
        config_manager,
        "get_config",
        lambda: {"LLM_PROVIDER": provider, "PRIMARY_MODEL": primary_model},
    )
    monkeypatch.setattr(
        thinking.llama_model_manager,
        "get_selected_model_id",
        lambda: selected_model_id,
    )


def test_gate_remote_providers_always_on(monkeypatch):
    _patch_gate(monkeypatch, "openai", None)
    assert thinking.chat_thinking_enabled() is True


def test_gate_local_enabled_for_large_models(monkeypatch):
    _patch_gate(monkeypatch, "local", "qwen3.5-9b")
    assert thinking.chat_thinking_enabled() is True


def test_gate_local_disabled_for_small_models(monkeypatch):
    _patch_gate(monkeypatch, "local", "qwen3.5-4b")
    assert thinking.chat_thinking_enabled() is False


def test_gate_local_falls_back_to_model_name_regex(monkeypatch):
    _patch_gate(monkeypatch, "local", None, primary_model="Qwen3.5-27B-Q4_K_M")
    assert thinking.chat_thinking_enabled() is True
    _patch_gate(monkeypatch, "local", None, primary_model="some-unknown-model")
    assert thinking.chat_thinking_enabled() is False


# ------------------------------------------------- vision persistence


def test_vision_probe_result_survives_cache_reload():
    from server.api.chat import (
        _build_vision_cache_key,
        _get_vision_capability_cache,
        _store_vision_probe_result,
    )

    _store_vision_probe_result(
        provider="openai",
        base_url="https://api.openai.com",
        model="gpt-test",
        vision_capable=True,
        status_code=200,
        detail="probe test",
    )
    key = _build_vision_cache_key("openai", "https://api.openai.com", "gpt-test")
    try:
        # Reload from DB: the row must persist via the capability store.
        config_manager._load_configs()
        cached = _get_vision_capability_cache().get(key)
        assert cached is not None
        assert cached["vision_capable"] is True
        assert cached["probed_at"]
    finally:
        config_manager.set_capability(key, {})
