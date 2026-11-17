"""Tests for chart insights streaming (reasoning tool)."""

import pytest


class _FakeConfigManager:
    def __init__(self, reasoning_system):
        self._prompts = {
            "prompts": {"reasoning": {"system": reasoning_system}},
            "options": {"reasoning": {}},
        }

    def get_config(self):
        return {"REASONING_MODEL": "test-model"}

    def get_prompts_and_options(self):
        return self._prompts


class _ScriptedLLMClient:
    def __init__(self, scripts):
        self.scripts = list(scripts)
        self.calls = []

    async def chat(self, model, messages, options=None, tools=None, stream=False, format=None):
        self.calls.append(
            {
                "model": model,
                "messages": [dict(m) for m in messages],
                "stream": stream,
                "format": format,
            }
        )
        script = self.scripts.pop(0)

        if not stream:
            # Non-streaming call returns the response dict directly
            return script[0]

        async def _stream():
            for chunk in script:
                yield chunk

        return _stream()


class _RaisingLLMClient:
    async def chat(self, model, messages, options=None, tools=None, stream=False, format=None):
        raise RuntimeError("LLM unavailable")


class _FailOnFinalLLMClient:
    """Streams the first turn fine, then fails on the final structured call."""

    async def chat(self, model, messages, options=None, tools=None, stream=False, format=None):
        if not stream:
            raise RuntimeError("final call failed")

        async def _stream():
            yield {"message": {"content": "initial pass"}}

        return _stream()


def _apply_common_patches(monkeypatch, client, reasoning_system):
    from server.nlp_tools import reasoning as reasoning_module

    fake_config = _FakeConfigManager(reasoning_system)
    monkeypatch.setattr(reasoning_module, "config_manager", fake_config)
    monkeypatch.setattr(reasoning_module, "get_llm_client", lambda: client)
    monkeypatch.setattr(reasoning_module, "get_vector_store_manager", lambda: None)
    monkeypatch.setattr(reasoning_module, "get_tools_definition", lambda *a, **k: [])


@pytest.mark.asyncio
async def test_reasoning_uses_configured_prompt(monkeypatch):
    client = _ScriptedLLMClient(
        [
            # First turn: model answers without tool calls
            [{"message": {"content": "initial pass"}}],
            # Final structured call
            [
                {
                    "message": {
                        "content": '{"thinking": "t", "summary": "s", '
                        '"differentials": [], "investigations": [], '
                        '"clinical_considerations": []}'
                    }
                }
            ],
        ]
    )
    _apply_common_patches(monkeypatch, client, "CUSTOM_REASONING_PROMPT")

    from server.nlp_tools.reasoning import stream_chart_insights_with_tools

    events = []
    async for event in stream_chart_insights_with_tools(
        template_data={"history": "fatigue"},
        dob="1980-01-01",
        encounter_date="2026-01-01",
        gender="M",
        ur_number="UR12345",
    ):
        events.append(event)

    # The configured reasoning prompt reached the model (B6)
    first_call_messages = client.calls[0]["messages"]
    assert "CUSTOM_REASONING_PROMPT" in first_call_messages[0]["content"]

    # A valid result was produced
    results = [e for e in events if e["type"] == "result"]
    assert len(results) == 1
    assert results[0]["data"]["summary"] == "s"


@pytest.mark.asyncio
async def test_reasoning_malformed_final_output_yields_error_event(monkeypatch):
    client = _ScriptedLLMClient(
        [
            [{"message": {"content": "initial pass"}}],
            # Final structured call returns unparsable garbage
            [{"message": {"content": "not json at all {{{"}}],
        ]
    )
    _apply_common_patches(monkeypatch, client, "PROMPT")

    from server.nlp_tools.reasoning import stream_chart_insights_with_tools

    events = []
    async for event in stream_chart_insights_with_tools(
        template_data={"history": "fatigue"},
        dob="1980-01-01",
        encounter_date="2026-01-01",
        gender="F",
        ur_number=None,
    ):
        events.append(event)

    # Stream terminated with an error event, not an exception or a result
    errors = [e for e in events if e["type"] == "error"]
    results = [e for e in events if e["type"] == "result"]
    assert len(errors) == 1
    assert errors[0]["message"]
    assert results == []


@pytest.mark.asyncio
async def test_reasoning_llm_unreachable_yields_error_event(monkeypatch):
    client = _RaisingLLMClient()
    _apply_common_patches(monkeypatch, client, "PROMPT")

    from server.nlp_tools.reasoning import stream_chart_insights_with_tools

    events = []
    async for event in stream_chart_insights_with_tools(
        template_data={"history": "fatigue"},
        dob="1980-01-01",
        encounter_date="2026-01-01",
        gender="M",
        ur_number=None,
    ):
        events.append(event)

    # LLM failure after the response committed must surface as an error
    # event, never an exception that kills the SSE stream
    errors = [e for e in events if e["type"] == "error"]
    results = [e for e in events if e["type"] == "result"]
    assert len(errors) == 1
    assert errors[0]["message"]
    assert results == []


@pytest.mark.asyncio
async def test_reasoning_final_call_failure_yields_error_event(monkeypatch):
    client = _FailOnFinalLLMClient()
    _apply_common_patches(monkeypatch, client, "PROMPT")

    from server.nlp_tools.reasoning import stream_chart_insights_with_tools

    events = []
    async for event in stream_chart_insights_with_tools(
        template_data={"history": "fatigue"},
        dob="1980-01-01",
        encounter_date="2026-01-01",
        gender="F",
        ur_number=None,
    ):
        events.append(event)

    errors = [e for e in events if e["type"] == "error"]
    results = [e for e in events if e["type"] == "result"]
    assert len(errors) == 1
    assert errors[0]["message"]
    assert results == []
