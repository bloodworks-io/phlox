"""Tests for ChatEngine streaming behaviour and shared stream accumulators."""

import json
from types import SimpleNamespace

import pytest

from server.chat.config.prompts import build_system_messages
from server.chat.engine import ChatEngine
from server.chat.tools.accumulator import (
    coerce_stream_piece,
    merge_tool_call_delta,
)
from server.database.config.defaults.prompts import DEFAULT_PROMPTS

# ---------------------------------------------------------------------------
# merge_tool_call_delta / coerce_stream_piece
# ---------------------------------------------------------------------------


def test_merge_object_deltas_accumulate_name_and_arguments():
    accumulated = {}
    merge_tool_call_delta(
        accumulated,
        SimpleNamespace(
            index=0,
            id="",
            type="function",
            function=SimpleNamespace(name="pub", arguments='{"qu'),
        ),
    )
    merge_tool_call_delta(
        accumulated,
        SimpleNamespace(
            index=0,
            id="call_9",
            type="function",
            function=SimpleNamespace(name="med_search", arguments='ery": "x"}'),
        ),
    )
    assert accumulated[0]["id"] == "call_9"
    assert accumulated[0]["function"]["name"] == "pubmed_search"
    assert accumulated[0]["function"]["arguments"] == '{"query": "x"}'


def test_merge_full_dict_tool_calls_get_separate_slots():
    accumulated = {}
    merge_tool_call_delta(
        accumulated,
        {
            "id": "call_1",
            "function": {"name": "pubmed_search", "arguments": '{"query": "a"}'},
        },
    )
    merge_tool_call_delta(
        accumulated,
        {
            "id": "call_2",
            "function": {"name": "wiki_search", "arguments": '{"query": "b"}'},
        },
    )
    assert len(accumulated) == 2
    assert accumulated[0]["function"]["name"] == "pubmed_search"
    assert accumulated[1]["function"]["name"] == "wiki_search"


def test_merge_indexed_dict_pieces_accumulate_incrementally():
    accumulated = {}
    pieces = [
        {"index": 0, "function": {"name": "wiki_", "arguments": ""}},
        {"index": 0, "function": {"name": "search", "arguments": '{"query"'}},
        {"index": 0, "id": "call_z", "function": {"arguments": ': "c"}'}},
    ]
    for piece in pieces:
        merge_tool_call_delta(accumulated, piece)
    assert accumulated[0]["id"] == "call_z"
    assert accumulated[0]["function"]["name"] == "wiki_search"
    assert accumulated[0]["function"]["arguments"] == '{"query": "c"}'


def test_coerce_stream_piece_handles_common_shapes():
    assert coerce_stream_piece(None) == ""
    assert coerce_stream_piece("hi") == "hi"
    assert coerce_stream_piece(["a", {"text": "b"}, {"content": "c"}]) == "abc"
    assert coerce_stream_piece({"content": "d"}) == "d"
    assert coerce_stream_piece({"reasoning": "e"}) == "e"


def test_merge_full_dict_arguments_normalized_to_json_string():
    accumulated = {}
    merge_tool_call_delta(
        accumulated,
        {
            "id": "call_1",
            "function": {"name": "todo_list", "arguments": {"action": "list"}},
        },
    )
    args = accumulated[0]["function"]["arguments"]
    assert isinstance(args, str)
    assert json.loads(args) == {"action": "list"}


def test_merge_object_delta_with_dict_arguments():
    accumulated = {}
    merge_tool_call_delta(
        accumulated,
        SimpleNamespace(
            index=0,
            id="call_1",
            type="function",
            function=SimpleNamespace(name="todo_list", arguments={"action": "list"}),
        ),
    )
    args = accumulated[0]["function"]["arguments"]
    assert isinstance(args, str)
    assert json.loads(args) == {"action": "list"}


def test_merge_unindexed_dict_with_none_function_creates_empty_slot():
    accumulated = {}
    merge_tool_call_delta(accumulated, {"id": "call_x", "function": None})
    assert accumulated[0]["id"] == "call_x"
    assert accumulated[0]["function"] == {"name": "", "arguments": ""}


def test_merge_ignores_unidentifiable_dict_deltas():
    accumulated = {}
    merge_tool_call_delta(accumulated, {"function": {"arguments": '{"act'}})
    assert accumulated == {}


# ---------------------------------------------------------------------------
# build_system_messages mode handling
# ---------------------------------------------------------------------------


class _FakeConfigManager:
    def __init__(self, prompts):
        self._prompts = prompts

    def get_prompts_and_options(self):
        return self._prompts

    def get_user_settings(self):
        return {}


def _make_engine(llm_client):
    engine = ChatEngine.__new__(ChatEngine)
    engine.config = {"PRIMARY_MODEL": "test-model"}
    engine.llm_client = llm_client
    engine.vector_store_manager = None
    engine.logger = __import__("logging").getLogger(__name__)
    return engine


def test_build_system_messages_rag_mode_uses_rag_prompt(monkeypatch):
    prompts = {
        "prompts": {
            "chat": {"system": "CHAT_PROMPT"},
            "rag": {"system": "RAG_PROMPT"},
        },
        "options": {"general": {}},
    }
    monkeypatch.setattr("server.chat.config.prompts.config_manager", _FakeConfigManager(prompts))
    messages = build_system_messages(mode="rag")
    content = messages[0]["content"]
    assert content.startswith("RAG_PROMPT")
    assert "CHAT_PROMPT" not in content
    # Guardrail blocks are appended even in rag mode
    assert "PHI PROTECTION" in content
    assert "CITATION RULE" in content


def test_build_system_messages_patient_mode_uses_chat_prompt(monkeypatch):
    prompts = {
        "prompts": {
            "chat": {"system": "CHAT_PROMPT"},
            "rag": {"system": "RAG_PROMPT"},
        },
        "options": {"general": {}},
    }
    monkeypatch.setattr("server.chat.config.prompts.config_manager", _FakeConfigManager(prompts))
    messages = build_system_messages()
    assert messages[0]["content"].startswith("CHAT_PROMPT")


def test_build_system_messages_missing_rag_prompt_falls_back_to_default(monkeypatch):
    prompts = {"prompts": {"chat": {"system": "CHAT_PROMPT"}}, "options": {"general": {}}}
    monkeypatch.setattr("server.chat.config.prompts.config_manager", _FakeConfigManager(prompts))
    messages = build_system_messages(mode="rag")
    content = messages[0]["content"]
    assert DEFAULT_PROMPTS["prompts"]["rag"]["system"] in content
    assert "CHAT_PROMPT" not in content


# ---------------------------------------------------------------------------
# ChatEngine streaming with parallel tool calls + fallback hardening
# ---------------------------------------------------------------------------


def _chunk(message):
    return {"message": message}


class _ScriptedLLMClient:
    """Yields scripted streams per chat() call and records message lists."""

    def __init__(self, scripts):
        self.scripts = list(scripts)
        self.calls = []

    async def chat(self, model, messages, options=None, tools=None, stream=False):
        self.calls.append([dict(m) for m in messages])
        script = self.scripts.pop(0)

        async def _stream():
            for chunk in script:
                yield chunk

        return _stream()


class _RaisingLLMClient:
    async def chat(self, model, messages, options=None, tools=None, stream=False):
        raise RuntimeError("LLM unavailable")


@pytest.mark.asyncio
async def test_parallel_tool_calls_all_executed_and_appended(monkeypatch):
    tool_calls = [
        {"id": "call_1", "function": {"name": "pubmed_search", "arguments": '{"query": "a"}'}},
        {"id": "call_2", "function": {"name": "wiki_search", "arguments": '{"query": "b"}'}},
    ]
    client = _ScriptedLLMClient(
        [
            [_chunk({"content": "", "tool_calls": tool_calls})],
            [_chunk({"content": "Done [1] and [2]."})],
        ]
    )
    engine = _make_engine(client)

    async def fake_execute_tool_streaming(tool_call, **kwargs):
        name = tool_call["function"]["name"]
        yield {"type": "status", "content": f"running {name}"}
        yield {
            "type": "end",
            "function_response": {
                "content": f"result for {name} [1]",
                "citations": [{"title": name}],
            },
        }

    monkeypatch.setattr("server.chat.engine.execute_tool_streaming", fake_execute_tool_streaming)
    monkeypatch.setattr("server.chat.engine.get_tools_definition", lambda *a, **k: [])
    monkeypatch.setattr("server.chat.engine.chat_thinking_enabled", lambda: False)
    fake_config = _FakeConfigManager(
        {"prompts": {"chat": {"system": "S"}}, "options": {"general": {}}}
    )
    monkeypatch.setattr("server.chat.engine.config_manager", fake_config)
    monkeypatch.setattr("server.chat.config.prompts.config_manager", fake_config)

    events = []
    async for event in engine.get_streaming_response([{"role": "user", "content": "hi"}]):
        events.append(event)

    # Both tool calls were announced to the UI
    statuses = [e["content"] for e in events if e.get("type") == "status"]
    assert any("pubmed_search" in s for s in statuses)
    assert any("wiki_search" in s for s in statuses)

    # Final answer streamed through
    chunks = [e.get("content", "") for e in events if e.get("type") == "chunk"]
    assert "Done [1] and [2]." in "".join(chunks)

    # Both tool responses appended to the conversation for the next turn
    second_turn_messages = client.calls[1]
    tool_messages = [m for m in second_turn_messages if m.get("role") == "tool"]
    assert len(tool_messages) == 2
    assert tool_messages[0]["tool_call_id"] == "call_1"
    assert tool_messages[1]["tool_call_id"] == "call_2"
    # Citation markers for the second tool were shifted by the first tool's citations
    assert "result for wiki_search [2]" in tool_messages[1]["content"]

    # End event carries merged citations from both tools
    end_events = [e for e in events if e.get("type") == "end"]
    assert len(end_events) == 1
    assert end_events[0]["function_response"]["citations"] == [
        {"title": "pubmed_search"},
        {"title": "wiki_search"},
    ]


@pytest.mark.asyncio
async def test_stream_ends_cleanly_when_llm_unavailable(monkeypatch):
    engine = _make_engine(_RaisingLLMClient())
    monkeypatch.setattr("server.chat.engine.get_tools_definition", lambda *a, **k: [])
    monkeypatch.setattr("server.chat.engine.chat_thinking_enabled", lambda: False)
    fake_config = _FakeConfigManager(
        {"prompts": {"chat": {"system": "S"}}, "options": {"general": {}}}
    )
    monkeypatch.setattr("server.chat.engine.config_manager", fake_config)
    monkeypatch.setattr("server.chat.config.prompts.config_manager", fake_config)

    events = []
    async for event in engine.get_streaming_response([{"role": "user", "content": "hi"}]):
        events.append(event)

    # No exception escaped; the stream still produced an error chunk and an end event
    chunks = [e.get("content", "") for e in events if e.get("type") == "chunk"]
    assert any("error" in c.lower() for c in chunks)
    assert events[-1].get("type") == "end"


@pytest.mark.asyncio
async def test_bracketed_ids_not_shifted_for_tools_without_citations(monkeypatch):
    """A citing tool renumbers its markers; a non-citing tool (e.g. todo ids)
    must keep its bracketed numbers untouched."""
    tool_calls = [
        {"id": "call_1", "function": {"name": "wiki_search", "arguments": '{"query": "a"}'}},
        {"id": "call_2", "function": {"name": "todo_list", "arguments": '{"action": "list"}'}},
    ]
    client = _ScriptedLLMClient(
        [
            [_chunk({"content": "", "tool_calls": tool_calls})],
            [_chunk({"content": "Done."})],
        ]
    )
    engine = _make_engine(client)

    async def fake_execute_tool_streaming(tool_call, **kwargs):
        name = tool_call["function"]["name"]
        if name == "wiki_search":
            yield {
                "type": "end",
                "function_response": {
                    "content": "wiki result [1] and [2]",
                    "citations": [{"title": "w1"}, {"title": "w2"}],
                },
            }
        else:
            yield {
                "type": "end",
                "function_response": {
                    "content": "Todo List:\n  ○ [1] a task",
                    "citations": [],
                },
            }

    monkeypatch.setattr("server.chat.engine.execute_tool_streaming", fake_execute_tool_streaming)
    monkeypatch.setattr("server.chat.engine.get_tools_definition", lambda *a, **k: [])
    monkeypatch.setattr("server.chat.engine.chat_thinking_enabled", lambda: False)
    fake_config = _FakeConfigManager(
        {"prompts": {"chat": {"system": "S"}}, "options": {"general": {}}}
    )
    monkeypatch.setattr("server.chat.engine.config_manager", fake_config)
    monkeypatch.setattr("server.chat.config.prompts.config_manager", fake_config)

    events = []
    async for event in engine.get_streaming_response([{"role": "user", "content": "hi"}]):
        events.append(event)

    second_turn_messages = client.calls[1]
    tool_messages = [m for m in second_turn_messages if m.get("role") == "tool"]
    assert len(tool_messages) == 2
    assert "wiki result [1] and [2]" in tool_messages[0]["content"]
    # Second tool returned no citations: its "[1]" must NOT be renumbered to "[3]"
    assert "○ [1] a task" in tool_messages[1]["content"]

    end_events = [e for e in events if e.get("type") == "end"]
    assert end_events[0]["function_response"]["citations"] == [{"title": "w1"}, {"title": "w2"}]
