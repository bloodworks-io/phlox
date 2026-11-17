import asyncio
import json
import logging
from typing import Any, Literal

from pydantic import BaseModel, Field

from server.database.config.manager import config_manager
from server.llm_client.client import get_llm_client
from server.schemas.grammars import CompactGroundingFieldsResponse, GroundingResponse
from server.schemas.templates import TemplateField
from server.transcription.speakers import numbered_transcript
from server.transcription.text import build_extraction_messages

logger = logging.getLogger(__name__)

# Deterministic grounding: analysis, not generation.
GROUNDING_SEED = 123

# The warm stop turn decodes one citation entry per note line; on slow local
# deployments that outlives the shared 80s client default.
GROUNDING_CALL_TIMEOUT_SECONDS = 240

Verdict = Literal["supported", "unverified", "conflict"]

_GROUNDING_INSTRUCTION = """Each line of the transcript above is prefixed with its 0-based line index in brackets. A note field produced from that transcript follows, its lines numbered the same way.

Note field "{field_name}":
{note_lines}

For EACH note line, report the transcript line indices that directly support it (sources) and the transcript line indices that state the opposite (contradicts). Use empty lists when there are none. Cite only indices that appear in the transcript above. Output ONLY JSON: {{"lines": [{{"line_index": <note line index>, "sources": [<transcript line indices>], "contradicts": [<transcript line indices>]}}]}}."""


class LineCitation(BaseModel):
    """Grounding result for one logical line of a note field (persisted shape)."""

    line_index: int
    text: str
    sources: list[int] = Field(default_factory=list)
    contradicts: list[int] = Field(default_factory=list)
    verdict: Verdict


def _verdict(sources: list[int], contradicts: list[int]) -> Verdict:
    if contradicts:
        return "conflict"
    return "supported" if sources else "unverified"


def _clean_indices(values: object, limit: int) -> list[int]:
    """Keep in-range integers, deduped and sorted."""
    if not isinstance(values, list):
        return []
    return sorted(
        {v for v in values if isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= limit}
    )


def _build_suffix(field_name: str, note_lines: list[tuple[int, str]]) -> str:
    return _GROUNDING_INSTRUCTION.format(
        field_name=field_name,
        note_lines="\n".join(f"[{i}] {line}" for i, line in note_lines),
    )


def _baseline_filtered_lines(content: str, baseline: str | None) -> list[tuple[int, str]]:
    """Non-empty lines with their split-indices, minus lines already present
    in the baseline content."""
    baseline_lines = {line.strip() for line in (baseline or "").split("\n") if line.strip()}
    return [
        (i, line)
        for i, line in enumerate(content.split("\n"))
        if line.strip() and line.strip() not in baseline_lines
    ]


async def ground_field(
    field_name: str,
    field_content: str,
    numbered: list[tuple[int, str]],
    prefix_messages: list[dict[str, str]],
    client,
    config: dict,
    options: dict,
    baseline_content: str | None = None,
) -> list[LineCitation]:
    """Ground one field's final content against the numbered transcript.

    Returns one LineCitation per non-empty note line; a failed call returns []
    (no citations), which callers treat as "render as today". Lines already
    present in ``baseline_content`` (the field's session-start text) are
    skipped: this session's transcript cannot support them.
    """
    note_lines = _baseline_filtered_lines(field_content, baseline_content)
    if not note_lines or not numbered:
        return []

    # Indices beyond the last non-empty transcript line are empty or
    # out of range — uncitable either way.
    max_transcript_index = numbered[-1][0]
    messages = [
        *prefix_messages,
        {"role": "user", "content": _build_suffix(field_name, note_lines)},
    ]
    call_options = {**options, "temperature": 0.0, "seed": GROUNDING_SEED}
    if config.get("LLM_PROVIDER") == "local":
        call_options["extra_body"] = {"cache_prompt": True}

    try:
        raw = await client.chat_with_structured_output(
            model=config["PRIMARY_MODEL"],
            messages=messages,
            schema=GroundingResponse.model_json_schema(),
            options=call_options,
        )
        parsed = json.loads(raw) if isinstance(raw, str) else raw
        entries = parsed.get("lines", []) if isinstance(parsed, dict) else []
    except Exception as exc:
        logger.warning(
            "Grounding failed for field %s (%s): %s", field_name, type(exc).__name__, exc
        )
        return []

    collected = _collect_entries(entries, note_lines, max_transcript_index)
    return _citations_for_lines(note_lines, collected)


def _collect_entries(
    entries: object, note_lines: list[tuple[int, str]], max_transcript_index: int
) -> dict[int, tuple[set[int], set[int]]]:
    """Fold raw model entries into per-note-line index sets, clamped."""
    valid = {i for i, _ in note_lines}
    collected: dict[int, tuple[set[int], set[int]]] = {}
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict):
            continue
        index = entry.get("line_index")
        if not isinstance(index, int) or isinstance(index, bool) or index not in valid:
            continue
        sources, contradicts = collected.setdefault(index, (set(), set()))
        sources.update(_clean_indices(entry.get("sources"), max_transcript_index))
        contradicts.update(_clean_indices(entry.get("contradicts"), max_transcript_index))
    return collected


def _citations_for_lines(
    note_lines: list[tuple[int, str]], collected: dict[int, tuple[set[int], set[int]]]
) -> list[LineCitation]:
    """One LineCitation per non-empty note line; model omissions -> unverified."""
    return [
        LineCitation(
            line_index=i,
            text=line,
            sources=sorted(sources),
            contradicts=sorted(contradicts),
            verdict=_verdict(sorted(sources), sorted(contradicts)),
        )
        for i, line in note_lines
        for sources, contradicts in [collected.get(i, (set(), set()))]
    ]


async def ground_note(
    template_fields: list[TemplateField],
    contents: dict[str, str],
    transcript_text: str,
    patient_context: dict[str, str | None],
    is_ambient: bool = True,
    primary_condition: str | None = None,
    include_persistent: bool = False,
    baseline_fields: dict[str, str] | None = None,
    client=None,
    config: dict | None = None,
    options: dict | None = None,
) -> dict[str, list[LineCitation]]:
    """Ground every field of a final note against its transcript."""
    fields = [f for f in template_fields if include_persistent or not f.persistent]
    targets = [
        (f.field_key, f.field_name, str(contents.get(f.field_key, "")))
        for f in fields
        if str(contents.get(f.field_key, "")).strip()
    ]
    numbered = numbered_transcript(transcript_text)
    if not targets or not numbered:
        return {}

    prefix_messages = build_extraction_messages(
        transcript_text, fields, patient_context, is_ambient, primary_condition
    )
    if client is None:
        client = get_llm_client()
    if config is None:
        config = config_manager.get_config()
    if options is None:
        options = config_manager.get_prompts_and_options()["options"]["general"]

    results = await asyncio.gather(
        *(
            ground_field(
                field_name,
                content,
                numbered,
                prefix_messages,
                client,
                config,
                options,
                baseline_content=(baseline_fields or {}).get(field_key),
            )
            for field_key, field_name, content in targets
        )
    )
    return {key: citations for (key, _, _), citations in zip(targets, results, strict=True)}


_CONVERSATION_GROUNDING_INSTRUCTION = """The transcript segments in this conversation are prefixed with their 0-based [N] line indices. The final note follows, each field's lines numbered the same way.

{field_blocks}

For each note line that has supporting or contradicting transcript lines, report the transcript line indices: sources directly support it, contradicts state the opposite. Omit "contradicts" when it is empty and omit lines with neither. Cite only indices that appear in the transcript above. Output ONLY JSON: {{"fields": [{{"field_key": <field key>, "lines": [{{"line": <note line index>, "sources": [<transcript indices>], "contradicts": [<transcript indices>]}}]}}]}}."""


def _is_tool_rejection(exc: Exception) -> bool:
    """True when a provider rejected the tools + structured-output combination."""
    status = getattr(exc, "status_code", None)
    if status == 400:
        return True
    text = str(exc).lower()
    return any(word in text for word in ("tool_choice", "response_format", "tools")) and any(
        marker in text for marker in ("unsupported", "not supported", "invalid")
    )


def _as_index_entry(entry: dict) -> dict:
    """Normalise a compact or legacy grounding entry to the collector shape."""
    return {
        "line_index": entry.get("line", entry.get("line_index")),
        "sources": entry.get("sources"),
        "contradicts": entry.get("contradicts"),
    }


def _entries_by_field(parsed: dict) -> dict[str, list]:
    """Fold the compact grouped response (and the legacy flat shape) into
    per-field entry lists."""
    entries_by_field: dict[str, list] = {}
    for field in parsed.get("fields") or []:
        if not isinstance(field, dict) or not isinstance(field.get("field_key"), str):
            continue
        for entry in field.get("lines") or []:
            if isinstance(entry, dict):
                entries_by_field.setdefault(field["field_key"], []).append(_as_index_entry(entry))
    for entry in parsed.get("lines") or []:
        if isinstance(entry, dict) and isinstance(entry.get("field_key"), str):
            entries_by_field.setdefault(entry["field_key"], []).append(_as_index_entry(entry))
    return entries_by_field


async def ground_via_conversation(
    agent_messages: list[dict[str, Any]],
    template_fields: list[TemplateField],
    contents: dict[str, str],
    transcript_line_count: int,
    include_persistent: bool = True,
    client=None,
    config: dict | None = None,
    options: dict | None = None,
    tools: list[dict[str, Any]] | None = None,
    baseline_fields: dict[str, str] | None = None,
) -> dict[str, list[LineCitation]]:
    """Ground the final note as one warm turn appended to the live conversation. """
    fields = [f for f in template_fields if include_persistent or not f.persistent]
    targets: list[tuple[str, str, list[tuple[int, str]]]] = []
    for field in fields:
        content = str(contents.get(field.field_key, ""))
        if not content.strip():
            continue
        note_lines = _baseline_filtered_lines(content, (baseline_fields or {}).get(field.field_key))
        if note_lines:
            targets.append((field.field_key, field.field_name, note_lines))
    if not targets or not agent_messages or transcript_line_count <= 0:
        return {}

    field_blocks = "\n\n".join(
        f'Field "{field_name}" ({field_key}):\n'
        + "\n".join(f"[{i}] {line}" for i, line in note_lines)
        for field_key, field_name, note_lines in targets
    )
    messages = [
        *agent_messages,
        {
            "role": "user",
            "content": _CONVERSATION_GROUNDING_INSTRUCTION.format(field_blocks=field_blocks),
        },
    ]
    if client is None:
        client = get_llm_client(timeout=GROUNDING_CALL_TIMEOUT_SECONDS)
    if config is None:
        config = config_manager.get_config()
    call_options = {
        **(options or config_manager.get_prompts_and_options()["options"]["general"]),
        "temperature": 0.0,
        "seed": GROUNDING_SEED,
    }
    if config.get("LLM_PROVIDER") == "local":
        call_options["extra_body"] = {"cache_prompt": True}
    if tools:
        call_options["tool_choice"] = "none"

    async def _call(active_tools):
        return await client.chat_with_structured_output(
            model=config["PRIMARY_MODEL"],
            messages=messages,
            schema=CompactGroundingFieldsResponse.model_json_schema(),
            options=call_options,
            tools=active_tools,
        )

    try:
        raw = await _call(tools)
    except Exception as exc:
        if not (tools and _is_tool_rejection(exc)):
            logger.warning("Conversation grounding failed (%s): %s", type(exc).__name__, exc)
            return {}
        logger.warning(
            "Conversation grounding: provider rejected tools alongside structured "
            "output (%s); retrying without tools (prefix cache will miss)",
            exc,
        )
        call_options.pop("tool_choice", None)
        tools = None
        try:
            raw = await _call(None)
        except Exception as retry_exc:
            logger.warning(
                "Conversation grounding failed (%s): %s", type(retry_exc).__name__, retry_exc
            )
            return {}

    try:
        parsed = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError as exc:
        logger.warning("Conversation grounding produced invalid JSON: %s", exc)
        return {}
    if not isinstance(parsed, dict):
        parsed = {}
    entries_by_field = _entries_by_field(parsed)

    max_index = transcript_line_count - 1
    return {
        field_key: _citations_for_lines(
            note_lines,
            _collect_entries(entries_by_field.get(field_key, []), note_lines, max_index),
        )
        for field_key, _, note_lines in targets
    }
