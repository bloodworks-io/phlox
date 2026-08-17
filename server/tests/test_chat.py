"""
Tests for the chat endpoint.
Uses TestClient for a synchronous test and mocks out external dependencies.
"""

import json
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.chat import router

app = FastAPI()
# Note: The chat router returns a StreamingResponse.
# For testing we simulate reading the full streamed content.
app.include_router(router, prefix="/api/chat")
client = TestClient(app)


def test_chat_endpoint_streaming():
    with patch("server.api.chat.ChatEngine", autospec=True) as MockChatEngine:
        mock_engine_instance = MockChatEngine.return_value

        async def fake_generate():
            yield "data: " + json.dumps({"chunk": "Part 1"}) + "\n\n"
            yield "data: " + json.dumps({"chunk": "Part 2"}) + "\n\n"

        mock_engine_instance.stream_chat.return_value = fake_generate()

        test_payload = {"messages": [{"role": "user", "content": "What is the capital of France?"}]}
        response = client.post("/api/chat", json=test_payload)

        # Fix: Use response.content instead of response.iter_lines()
        streamed_output = response.content.decode("utf-8")

        assert "Part 1" in streamed_output
        assert "Part 2" in streamed_output
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")


def test_vision_probe_writes_to_in_memory_cache():
    """_store_vision_probe_result writes to the module-level dict, not config."""
    from server.api.chat import _VISION_CACHE, _build_vision_cache_key, _store_vision_probe_result

    _store_vision_probe_result(
        provider="openai",
        base_url="http://example",
        model="gpt-4o",
        vision_capable=True,
        status_code=200,
        detail="probe ok",
    )
    key = _build_vision_cache_key("openai", "http://example", "gpt-4o")
    assert key in _VISION_CACHE
    assert _VISION_CACHE[key]["vision_capable"] is True
    assert _VISION_CACHE[key]["detail"] == "probe ok"

    # Reset for other tests.
    _VISION_CACHE.clear()


def test_vision_probe_does_not_mutate_config():
    """Storing a probe result must not write any VISION_* row to the config table."""
    from server.api.chat import _VISION_CACHE, _store_vision_probe_result
    from server.database.config.manager import config_manager

    config_manager.refresh_db()
    with config_manager.db.read() as cursor:
        cursor.execute("SELECT COUNT(*) FROM config WHERE key LIKE 'VISION%'")
        before = cursor.fetchone()[0]

    _store_vision_probe_result(
        provider="openai",
        base_url="",
        model="gpt-4o-mini",
        vision_capable=False,
        status_code=400,
        detail="no vision",
    )

    with config_manager.db.read() as cursor:
        cursor.execute("SELECT COUNT(*) FROM config WHERE key LIKE 'VISION%'")
        after = cursor.fetchone()[0]
    assert before == after

    _VISION_CACHE.clear()


def test_vision_capability_get_returns_no_cache_when_empty():
    """With an empty in-memory cache, the GET reader reports source=no_cache."""
    from unittest.mock import patch

    from server.api.chat import _VISION_CACHE

    _VISION_CACHE.clear()
    with patch("server.api.chat._is_local_vision_capable", return_value=False):
        response = client.get("/api/chat/vision-capability/current")
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "no_cache"
    assert data["vision_capable"] is False


def test_vision_capability_stored_key_only_travels_to_stored_url(monkeypatch):
    """vision-capability must not attach the stored key to a foreign base_url."""
    from server.database.config.manager import config_manager

    config_manager.update_config(
        {"LLM_BASE_URL": "http://stored.example/v1", "LLM_API_KEY": "sk-stored-secret"}
    )

    captured = {}

    class FakeLLM:
        def __init__(self, provider_type, base_url, api_key, **kwargs):
            captured["provider_type"] = provider_type
            captured["base_url"] = base_url
            captured["api_key"] = api_key
            captured["init_kwargs"] = kwargs

        async def chat(self, model, messages, options=None):
            captured["model"] = model
            captured["messages"] = messages
            captured["options"] = options
            return "ok"

    monkeypatch.setattr("server.api.chat.AsyncLLMClient", FakeLLM)

    # Foreign URL, no caller key: stored key never reaches the client.
    r = client.post("/api/chat/vision-capability", json={"base_url": "http://attacker.example/"})
    assert r.status_code == 200
    assert captured["api_key"] is None

    # Stored URL (± /v1, trailing slash), no caller key: stored key used.
    for base in ("http://stored.example", "http://stored.example/v1"):
        r = client.post("/api/chat/vision-capability", json={"base_url": base})
        assert r.status_code == 200
        assert captured["api_key"] == "sk-stored-secret"

    # Caller supplies both foreign URL and own key: caller key used.
    r = client.post(
        "/api/chat/vision-capability",
        json={"base_url": "http://attacker.example/", "api_key": "sk-caller"},
    )
    assert r.status_code == 200
    assert captured["api_key"] == "sk-caller"

    # No base_url at all: probes the stored config, stored key used.
    r = client.post("/api/chat/vision-capability", json={})
    assert r.status_code == 200
    assert captured["api_key"] == "sk-stored-secret"

    # Restore so other tests see a clean config.
    config_manager.update_config({"LLM_BASE_URL": "", "LLM_API_KEY": ""})


if __name__ == "__main__":
    test_chat_endpoint_streaming()
