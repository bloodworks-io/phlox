"""Tests for post-hoc note grounding (index hygiene, verdicts, prefix reuse)."""

import json

import pytest

from server.schemas.templates import TemplateField
from server.transcription.grounding import (
    LineCitation,
    ground_field,
    ground_note,
    ground_via_conversation,
)
from server.transcription.speakers import numbered_transcript, render_numbered
from server.transcription.text import build_extraction_messages

TRANSCRIPT = "\n".join(f"t{i}" for i in range(6))
NUMBERED = numbered_transcript(TRANSCRIPT)
PREFIX = [
    {"role": "system", "content": "extraction system prompt"},
    {"role": "user", "content": TRANSCRIPT},
]
OPTIONS = {"temperature": 0.7}
CONFIG = {"PRIMARY_MODEL": "test-model"}
EMPTY = {"lines": []}


class _FakeClient:
    """Records calls; returns canned payloads (JSON strings) or raises per call."""

    def __init__(self, payloads=None, error=None):
        self.payloads = payloads if payloads is not None else [EMPTY]
        self.error = error
        self.calls = []

    async def chat_with_structured_output(self, model, messages, schema, options, tools=None):
        self.calls.append(
            {"model": model, "messages": messages, "options": options, "tools": tools}
        )
        if self.error:
            raise self.error
        payload = self.payloads[min(len(self.calls) - 1, len(self.payloads) - 1)]
        if isinstance(payload, Exception):
            raise payload
        return json.dumps(payload)


class _RejectsToolsOnce:
    """Raises a 400 on the first call, then delegates to a fake client."""

    def __init__(self, payload):
        self._inner = _FakeClient(payloads=[payload])
        self.rejections = 0

    async def chat_with_structured_output(self, model, messages, schema, options, tools=None):
        if tools:
            self.rejections += 1
            raise type("Rejected", (Exception,), {"status_code": 400})("tools unsupported")
        return await self._inner.chat_with_structured_output(
            model, messages, schema, options, tools=tools
        )


def _field(key="clinical_history", name="Current History", persistent=False):
    return TemplateField(
        field_key=key,
        field_name=name,
        field_type="text",
        persistent=persistent,
        system_prompt="extract",
        style_example="• point",
    )


def test_numbered_transcript_preserves_split_indices():
    assert numbered_transcript("a\n\nb") == [(0, "a"), (2, "b")]
    assert numbered_transcript("") == []
    assert numbered_transcript("  \n ") == []


@pytest.mark.asyncio
async def test_ground_field_clamps_dedupes_and_sorts():
    client = _FakeClient(
        payloads=[
            {
                "lines": [
                    {"line_index": 0, "sources": [5, 3, 3, 99], "contradicts": []},
                    {"line_index": 1, "sources": [], "contradicts": [2]},
                    {"line_index": 7, "sources": [1], "contradicts": []},
                ]
            }
        ]
    )
    citations = await ground_field(
        "Current History", "• Fatigue\n• No chest pain", NUMBERED, PREFIX, client, CONFIG, OPTIONS
    )
    assert citations == [
        LineCitation(line_index=0, text="• Fatigue", sources=[3, 5], verdict="supported"),
        LineCitation(line_index=1, text="• No chest pain", contradicts=[2], verdict="conflict"),
    ]


@pytest.mark.asyncio
async def test_ground_field_marks_omitted_lines_unverified():
    client = _FakeClient(payloads=[EMPTY])
    citations = await ground_field(
        "Current History", "• Fatigue\n• Weight loss", NUMBERED, PREFIX, client, CONFIG, OPTIONS
    )
    assert [c.verdict for c in citations] == ["unverified", "unverified"]
    assert [c.text for c in citations] == ["• Fatigue", "• Weight loss"]


@pytest.mark.asyncio
async def test_ground_field_failure_returns_no_citations():
    client = _FakeClient(error=RuntimeError("model down"))
    assert await ground_field("F", "content", NUMBERED, PREFIX, client, CONFIG, OPTIONS) == []


@pytest.mark.asyncio
async def test_ground_field_skips_empty_lines_and_empty_content():
    client = _FakeClient()
    assert await ground_field("F", "  \n\n", NUMBERED, PREFIX, client, CONFIG, OPTIONS) == []
    citations = await ground_field("F", "a\n\nb", NUMBERED, PREFIX, client, CONFIG, OPTIONS)
    assert [c.line_index for c in citations] == [0, 2]


@pytest.mark.asyncio
async def test_ground_field_deterministic_options_and_local_cache_flag():
    client = _FakeClient(payloads=[EMPTY])
    await ground_field(
        "F", "content", NUMBERED, PREFIX, client, {**CONFIG, "LLM_PROVIDER": "local"}, OPTIONS
    )
    options = client.calls[0]["options"]
    assert options["temperature"] == 0.0
    assert options["seed"] == 123
    assert options["extra_body"] == {"cache_prompt": True}

    client = _FakeClient(payloads=[EMPTY])
    await ground_field(
        "F", "content", NUMBERED, PREFIX, client, {**CONFIG, "LLM_PROVIDER": "openai"}, OPTIONS
    )
    assert "extra_body" not in client.calls[0]["options"]


@pytest.mark.asyncio
async def test_ground_field_suffix_carries_no_transcript_copy():
    client = _FakeClient(payloads=[EMPTY])
    await ground_field("F", "content", NUMBERED, PREFIX, client, CONFIG, OPTIONS)
    messages = client.calls[0]["messages"]
    assert messages[:2] == PREFIX
    suffix = messages[2]
    assert suffix["role"] == "user"
    assert 'Note field "F"' in suffix["content"]
    assert "[0] content" in suffix["content"]
    # The transcript lives once, in the warmed prefix — never in the suffix.
    assert "t0" not in suffix["content"]
    assert "[5] t5" not in suffix["content"]


def test_render_numbered_is_append_stable():
    first = render_numbered("a\nb")
    assert first == "[0] a\n[1] b"
    # Streaming invariant: existing lines' rendering never changes as the
    # transcript grows, so prompts nest and the KV prefix cache holds.
    assert render_numbered("a\nb\nc").startswith(first)
    assert render_numbered("a\n\nb") == "[0] a\n[2] b"


def test_extraction_messages_number_the_transcript_once():
    messages = build_extraction_messages("l0\nl1", [_field()], {"name": "T"})
    assert messages[1] == {"role": "user", "content": "[0] l0\n[1] l1"}
    assert "0-based indices in brackets" in messages[0]["content"]
    assert "never include these indices" in messages[0]["content"]


def _make_fields():
    return [_field(), _field(key="pmh", name="Past Medical History", persistent=True)]


@pytest.mark.asyncio
async def test_ground_note_ambient_prefix_is_byte_identical_to_extraction():
    client = _FakeClient(payloads=[EMPTY])
    fields = _make_fields()
    await ground_note(
        fields,
        {"clinical_history": "• Fatigue", "pmh": "• Hypertension"},
        TRANSCRIPT,
        {"name": "Test"},
        client=client,
        config=CONFIG,
        options=OPTIONS,
    )
    # Only the non-persistent field is grounded...
    assert len(client.calls) == 1
    # ...and the prefix matches build_extraction_messages with the same filter.
    expected = build_extraction_messages(TRANSCRIPT, [fields[0]], {"name": "Test"})
    assert client.calls[0]["messages"][:2] == expected


@pytest.mark.asyncio
async def test_ground_note_include_persistent_grounds_everything():
    client = _FakeClient(payloads=[EMPTY])
    await ground_note(
        _make_fields(),
        {"clinical_history": "• Fatigue", "pmh": "• Hypertension"},
        TRANSCRIPT,
        {},
        include_persistent=True,
        client=client,
        config=CONFIG,
        options=OPTIONS,
    )
    assert len(client.calls) == 2


@pytest.mark.asyncio
async def test_ground_note_isolates_per_field_failures():
    client = _FakeClient(payloads=[RuntimeError("boom"), EMPTY])
    result = await ground_note(
        _make_fields(),
        {"clinical_history": "A", "pmh": "B"},
        TRANSCRIPT,
        {},
        include_persistent=True,
        client=client,
        config=CONFIG,
        options=OPTIONS,
    )
    assert result["clinical_history"] == []
    assert [c.text for c in result["pmh"]] == ["B"]


@pytest.mark.asyncio
async def test_ground_note_skips_empty_fields_and_transcripts():
    client = _FakeClient(payloads=[EMPTY])
    result = await ground_note(
        _make_fields(),
        {"clinical_history": "", "pmh": "  "},
        TRANSCRIPT,
        {},
        client=client,
        config=CONFIG,
        options=OPTIONS,
    )
    assert result == {}
    result = await ground_note(
        _make_fields(),
        {"clinical_history": "A"},
        "  \n ",
        {},
        client=client,
        config=CONFIG,
        options=OPTIONS,
    )
    assert result == {}


@pytest.mark.asyncio
async def test_ground_via_conversation_combined_warm_turn():
    client = _FakeClient(
        payloads=[
            {
                "fields": [
                    {
                        "field_key": "clinical_history",
                        "lines": [
                            {"line": 0, "sources": [1]},
                            # Out-of-range note line: dropped by the collector.
                            {"line": 5, "sources": [0]},
                        ],
                    },
                    {"field_key": "bogus", "lines": [{"line": 0, "sources": [0]}]},
                    {"field_key": "pmh", "lines": []},
                ]
            }
        ]
    )
    conversation = [{"role": "system", "content": "sys"}]
    result = await ground_via_conversation(
        conversation,
        _make_fields(),
        {"clinical_history": "A\nB", "pmh": "C"},
        transcript_line_count=6,
        client=client,
        config=CONFIG,
        options=OPTIONS,
    )
    # Cited line supported; omitted lines unverified; junk fields/indices dropped.
    assert result["clinical_history"][0].verdict == "supported"
    assert result["clinical_history"][1].verdict == "unverified"
    assert result["pmh"][0].verdict == "unverified"
    assert set(result) == {"clinical_history", "pmh"}
    # Warm turn: suffix appended after the conversation, which is not mutated.
    messages = client.calls[0]["messages"]
    assert messages[:1] == conversation
    assert messages[-1]["role"] == "user"
    assert "clinical_history" in messages[-1]["content"]
    assert len(conversation) == 1


@pytest.mark.asyncio
async def test_ground_via_conversation_accepts_legacy_flat_shape():
    client = _FakeClient(
        payloads=[
            {
                "lines": [
                    {"field_key": "clinical_history", "line_index": 0, "sources": [1]},
                ]
            }
        ]
    )
    result = await ground_via_conversation(
        [{"role": "system", "content": "sys"}],
        _make_fields(),
        {"clinical_history": "A", "pmh": "C"},
        transcript_line_count=6,
        client=client,
        config=CONFIG,
        options=OPTIONS,
    )
    assert result["clinical_history"][0].verdict == "supported"


@pytest.mark.asyncio
async def test_ground_via_conversation_sends_tools_with_tool_choice_none():
    client = _FakeClient(payloads=[{"fields": []}])
    tools = [{"type": "function", "function": {"name": "noop"}}]
    await ground_via_conversation(
        [{"role": "system", "content": "sys"}],
        _make_fields(),
        {"clinical_history": "A"},
        transcript_line_count=3,
        client=client,
        config=CONFIG,
        options=OPTIONS,
        tools=tools,
    )
    call = client.calls[0]
    # Same tools as the agent ticks -> identical rendered prompt (cache hit);
    # "none" keeps the schema in charge of decoding on vLLM/llama.cpp.
    assert call["tools"] == tools
    assert call["options"]["tool_choice"] == "none"


@pytest.mark.asyncio
async def test_ground_via_conversation_retries_without_tools_on_rejection():
    client = _RejectsToolsOnce(payload={"fields": []})
    result = await ground_via_conversation(
        [{"role": "system", "content": "sys"}],
        _make_fields(),
        {"clinical_history": "A"},
        transcript_line_count=3,
        client=client,
        config=CONFIG,
        options=OPTIONS,
        tools=[{"type": "function", "function": {"name": "noop"}}],
    )
    assert client.rejections == 1
    assert client._inner.calls[0]["tools"] is None
    assert "tool_choice" not in client._inner.calls[0]["options"]
    # The retry grounded: empty payload -> every line unverified, not a failure.
    assert result["clinical_history"][0].verdict == "unverified"


@pytest.mark.asyncio
async def test_ground_via_conversation_skips_baseline_lines():
    client = _FakeClient(payloads=[{"fields": []}])
    result = await ground_via_conversation(
        [{"role": "system", "content": "sys"}],
        _make_fields(),
        {"clinical_history": "carried over\n• New finding", "pmh": "all old"},
        transcript_line_count=6,
        client=client,
        config=CONFIG,
        options=OPTIONS,
        baseline_fields={"clinical_history": "carried over", "pmh": "all old"},
    )
    # Only the session's new line is grounded; fully-baseline fields drop out.
    assert set(result) == {"clinical_history"}
    assert [c.text for c in result["clinical_history"]] == ["• New finding"]
    assert result["clinical_history"][0].line_index == 1
    suffix = client.calls[0]["messages"][-1]["content"]
    assert "[1] • New finding" in suffix
    assert "carried over" not in suffix


@pytest.mark.asyncio
async def test_ground_note_skips_baseline_lines():
    client = _FakeClient(payloads=[EMPTY])
    result = await ground_note(
        _make_fields(),
        {"clinical_history": "old line\nnew line", "pmh": "ancient"},
        TRANSCRIPT,
        {},
        include_persistent=True,
        baseline_fields={"clinical_history": "old line", "pmh": "ancient"},
        client=client,
        config=CONFIG,
        options=OPTIONS,
    )
    # The fully-baseline persistent field makes no LLM call and gets no citations.
    assert result["pmh"] == []
    assert len(client.calls) == 1
    assert [c.text for c in result["clinical_history"]] == ["new line"]
    suffix = client.calls[0]["messages"][2]["content"]
    assert "new line" in suffix
    assert "old line" not in suffix


@pytest.mark.asyncio
async def test_ground_via_conversation_failure_and_empty_inputs():
    empty_conversation = [{"role": "system", "content": "s"}]
    assert (
        await ground_via_conversation(
            [],
            _make_fields(),
            {"plan": "x"},
            3,
            client=_FakeClient(),
            config=CONFIG,
            options=OPTIONS,
        )
        == {}
    )
    failing = _FakeClient(error=RuntimeError("boom"))
    assert (
        await ground_via_conversation(
            empty_conversation,
            _make_fields(),
            {"plan": "x"},
            3,
            client=failing,
            config=CONFIG,
            options=OPTIONS,
        )
        == {}
    )
    # No non-empty field content -> nothing to ground.
    assert (
        await ground_via_conversation(
            empty_conversation,
            _make_fields(),
            {"plan": "  "},
            3,
            client=_FakeClient(),
            config=CONFIG,
            options=OPTIONS,
        )
        == {}
    )
    # Everything baseline-carried -> nothing to ground.
    assert (
        await ground_via_conversation(
            empty_conversation,
            _make_fields(),
            {"plan": "unchanged"},
            3,
            client=_FakeClient(),
            config=CONFIG,
            options=OPTIONS,
            baseline_fields={"plan": "unchanged"},
        )
        == {}
    )
