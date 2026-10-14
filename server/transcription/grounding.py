import asyncio
import json
import logging
from typing import Literal

from pydantic import BaseModel, Field

from server.database.config.manager import config_manager
from server.llm_client.client import get_llm_client
from server.schemas.grammars import GroundingResponse
from server.schemas.templates import TemplateField
from server.transcription.speakers import numbered_transcript
from server.transcription.text import build_extraction_messages

logger = logging.getLogger(__name__)

# Deterministic grounding: analysis, not generation.
GROUNDING_SEED = 123

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


async def ground_field(
    field_name: str,
    field_content: str,
    numbered: list[tuple[int, str]],
    prefix_messages: list[dict[str, str]],
    client,
    config: dict,
    options: dict,
) -> list[LineCitation]:
    """Ground one field's final content against the numbered transcript.

    Returns one LineCitation per non-empty note line; a failed call returns []
    (no citations), which callers treat as "render as today".
    """
    note_lines = [(i, line) for i, line in enumerate(field_content.split("\n")) if line.strip()]
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

    collected: dict[int, tuple[set[int], set[int]]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        index = entry.get("line_index")
        if not isinstance(index, int) or isinstance(index, bool) or index not in dict(note_lines):
            continue
        sources, contradicts = collected.setdefault(index, (set(), set()))
        sources.update(_clean_indices(entry.get("sources"), max_transcript_index))
        contradicts.update(_clean_indices(entry.get("contradicts"), max_transcript_index))

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
            ground_field(field_name, content, numbered, prefix_messages, client, config, options)
            for _, field_name, content in targets
        )
    )
    return {key: citations for (key, _, _), citations in zip(targets, results, strict=True)}
