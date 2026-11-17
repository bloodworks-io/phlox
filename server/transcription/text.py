import asyncio
import json
import logging
import random
import re
import time
from typing import Any

from server.database.config.manager import config_manager
from server.llm_client import repair_json
from server.llm_client.client import get_llm_client
from server.schemas.grammars import MultiFieldResponse
from server.schemas.templates import TemplateField, TemplateResponse
from server.transcription.refinement import refine_field_content
from server.transcription.speakers import (
    numbered_transcript,
    render_numbered,
    speaker_legend_hint,
)

logger = logging.getLogger(__name__)

# Applied when a field has no content after extraction and refinement
EMPTY_FIELD_PLACEHOLDER = "Nil documented"


def _resolve_grounding_context(
    transcript_text: str,
    fields: list[TemplateField],
    patient_context: dict[str, str | None],
    is_ambient: bool,
    primary_condition: str | None,
) -> tuple | None:
    """Client/config/prefix for post-hoc grounding, or None when unavailable."""
    numbered = numbered_transcript(transcript_text)
    if not numbered:
        return None
    try:
        prefix_messages = build_extraction_messages(
            transcript_text, fields, patient_context, is_ambient, primary_condition
        )
        config = config_manager.get_config()
        options = config_manager.get_prompts_and_options()["options"]["general"]
        client = get_llm_client()
    except Exception as exc:
        logger.warning("Grounding unavailable for this run (%s): %s", type(exc).__name__, exc)
        return None
    return prefix_messages, numbered, client, config, options


async def process_transcription(
    transcript_text: str,
    template_fields: list[TemplateField],
    patient_context: dict[str, str | None],
    is_ambient: bool = True,
    primary_condition: str | None = None,
) -> dict[str, Any]:
    """
    Process the transcribed text to generate summaries for non-persistent template fields.
    """
    from server.transcription.grounding import ground_field  # local: grounding imports text

    process_start = time.perf_counter()

    try:
        # Filter for non-persistent fields only
        non_persistent_fields = [field for field in template_fields if not field.persistent]

        total_fields = len(non_persistent_fields)

        # Process only non-persistent fields concurrently with mode-specific summarization
        mode_label = "Ambient" if is_ambient else "Dictate"
        logger.info(f"Processing {total_fields} fields ({mode_label} Mode)...")
        raw_results_dict = await process_all_fields_concurrently(
            transcript_text, non_persistent_fields, patient_context, is_ambient, primary_condition
        )
        # Convert to list of TemplateResponse for compatibility with refinement step
        raw_results = [
            TemplateResponse(field_key=k, content=v) for k, v in raw_results_dict.items()
        ]
        logger.info(f"Successfully summarised {total_fields} fields")

        # Best-effort grounding context for the post-hoc citation pass
        grounding = _resolve_grounding_context(
            transcript_text, non_persistent_fields, patient_context, is_ambient, primary_condition
        )

        # Refine each field, then ground it as soon as its refinement lands
        # (overlap across fields; each grounding call hits the warm prefix)
        async def _refine_and_ground(result, field):
            refined = await refine_field_content(result.content, field, is_ambient=is_ambient)
            citations = []
            if grounding is not None and str(refined).strip():
                prefix_messages, numbered, client, config, options = grounding
                citations = await ground_field(
                    field.field_name,
                    str(refined),
                    numbered,
                    prefix_messages,
                    client,
                    config,
                    options,
                )
            return refined, citations

        logger.info(f"Refining {total_fields} fields...")
        paired_results = await asyncio.gather(
            *[
                _refine_and_ground(result, field)
                for result, field in zip(raw_results, non_persistent_fields, strict=True)
            ]
        )
        logger.info(f"Successfully refined {total_fields} fields")

        # Combine results into a dictionary; fields that ended up empty
        # (nothing extracted, or refinement produced nothing) get an explicit
        # placeholder rather than a blank field
        processed_fields = {
            field.field_key: (
                refined_content if str(refined_content).strip() else EMPTY_FIELD_PLACEHOLDER
            )
            for field, (refined_content, _citations) in zip(
                non_persistent_fields, paired_results, strict=True
            )
        }
        citations = {
            field.field_key: [citation.model_dump() for citation in field_citations]
            for field, (_refined, field_citations) in zip(
                non_persistent_fields, paired_results, strict=True
            )
            if field_citations
        }

        process_duration = time.perf_counter() - process_start

        return {
            "fields": processed_fields,
            "citations": citations,
            "process_duration": float(f"{process_duration:.2f}"),
        }

    except Exception as e:
        logger.error(f"Error in process_transcription: {e}")
        raise


def build_extraction_messages(
    transcript_text: str,
    fields: list[TemplateField],
    patient_context: dict[str, str | None],
    is_ambient: bool = True,
    primary_condition: str | None = None,
    intro_override: str | None = None,
) -> list[dict[str, str]]:
    """Build the [system, user] message pair for the multi-field extraction call."""
    field_instructions = []
    for field in fields:
        field_instruction = f"""FIELD: {field.field_key}
NAME: {field.field_name}
INSTRUCTIONS: {(field.system_prompt or "").strip()}"""
        field_instructions.append(field_instruction)

    patient_context_str = _build_patient_context(patient_context)

    # Use mode-specific intro for the system prompt
    if intro_override is not None:
        intro = intro_override
    elif is_ambient:
        intro = "Extract relevant information for each of the following fields from the medical transcript."
    else:
        intro = "Extract and organize information from the clinician's direct dictation for each of the following fields."

    if primary_condition:
        intro += f" This is a returning patient who sees the clinician for {primary_condition}."

    # Live-agent and capture transcripts carry best-effort speaker labels.
    legend = speaker_legend_hint(transcript_text)
    if legend:
        intro += f" {legend}"

    # Prompt-layer line indices: grounding's citation keys, numbered once here
    # so warm -> extraction -> grounding share a byte-identical prefix.
    intro += (
        " Transcript lines are prefixed with 0-based indices in brackets for "
        "reference; never include these indices in your output."
    )

    system_content = f"""{intro}

{patient_context_str}

For each field, extract only the most relevant discussion points. If no relevant information is found for a field, return an empty list for that field.

FIELDS:
{chr(10).join(field_instructions)}

Output MUST be ONLY valid JSON with top-level key "field_summaries" (object mapping field_key to array of strings)."""

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": render_numbered(transcript_text)},
    ]


async def process_all_fields_concurrently(
    transcript_text: str,
    fields: list[TemplateField],
    patient_context: dict[str, str | None],
    is_ambient: bool = True,
    primary_condition: str | None = None,
    intro_override: str | None = None,
) -> dict[str, str]:
    """
    Process all template fields in a single LLM call using structured output.

    Builds a unified prompt with all field system prompts and patient context,
    then parses the multi-field response into a dictionary of formatted contents.
    """

    max_retries = 1

    for attempt in range(max_retries + 1):
        try:
            config = config_manager.get_config()
            options = config_manager.get_prompts_and_options()["options"]["general"]

            client = get_llm_client()
            response_format = MultiFieldResponse.model_json_schema()
            model_name = config["PRIMARY_MODEL"]

            request_body = build_extraction_messages(
                transcript_text,
                fields,
                patient_context,
                is_ambient,
                primary_condition,
                intro_override,
            )

            random_seed = random.randint(0, 2**32 - 1)  # nosec B311

            logger.info(
                f"Processing {len(fields)} fields in one call (attempt {attempt + 1}/{max_retries + 1})..."
            )

            response = await client.chat(
                model=model_name,
                messages=request_body,
                format=response_format,
                options={**options, "seed": random_seed},
            )

            # Extract and repair JSON
            content = response["message"]["content"]
            repaired_content = repair_json(content)

            # Parse with tolerance for small-model response shapes
            summaries = _parse_field_summaries(repaired_content, fields)

            # Convert to dict of formatted strings (with bullet points)
            formatted_results = {}
            for field in fields:
                key_points = summaries.get(field.field_key, [])
                formatted_content = "\n".join(
                    f"• {_capitalize_first_char(point.strip())}"
                    for point in key_points
                    if point.strip()
                )
                formatted_results[field.field_key] = formatted_content

            logger.info(f"Successfully processed {len(fields)}")

            return formatted_results

        except Exception as e:
            if attempt < max_retries:
                logger.warning(
                    f"Error processing all fields concurrently (attempt {attempt + 1}/{max_retries + 1}): {e}. Retrying..."
                )
                continue
            else:
                logger.error(
                    f"Error processing all fields concurrently after {max_retries + 1} attempts: {e}"
                )
                raise
    raise RuntimeError("Unreachable: process_all_fields_concurrently exhausted retries")


def _capitalize_first_char(text: str) -> str:
    """Capitalize the first character of a string."""
    if not text:
        return text
    return text[0].upper() + text[1:] if text else text


def _normalize_field_key(text: str) -> str:
    """Normalize a field key or name for alias matching ("Current History" -> "current_history")."""
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _parse_field_summaries(content: str, fields: list[TemplateField]) -> dict[str, list[str]]:
    """Parse the multi-field extraction response into a field_key -> key points mapping.

    Tolerates small-model response shapes: bare {field_key: [...]} mappings
    without the "field_summaries" wrapper, double-wrapped envelopes, keys that
    echo the field name instead of the field key, and single strings in place
    of arrays. Raises when no field can be resolved so callers can retry.
    """
    if not content or not str(content).strip():
        raise ValueError("empty extraction response")

    start = content.find("{")
    end = content.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in extraction response")

    parsed = json.loads(content[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("extraction response is not a JSON object")

    # De-nest double-wrapped field_summaries envelopes (bounded)
    source = parsed
    for _ in range(3):
        nested = source.get("field_summaries")
        if isinstance(nested, dict):
            source = nested
        else:
            break

    # Keys resolve via field_key or the normalized field name: small models
    # sometimes echo the NAME ("Current History") instead of the key
    aliases: dict[str, str] = {}
    for field in fields:
        aliases[_normalize_field_key(field.field_key)] = field.field_key
        aliases[_normalize_field_key(field.field_name)] = field.field_key

    summaries: dict[str, list[str]] = {}
    for key, value in source.items():
        resolved = aliases.get(key) or aliases.get(_normalize_field_key(key))
        if not resolved:
            continue  # drop junk keys
        if isinstance(value, list):
            summaries.setdefault(resolved, []).extend(str(point) for point in value)
        elif isinstance(value, str) and value.strip():
            summaries.setdefault(resolved, []).append(value)  # single string — accept as one point

    if not summaries:
        raise ValueError(
            "no recognized fields in extraction JSON "
            f"(keys: {', '.join(str(k) for k in list(source)[:8])})"
        )
    return summaries


def _build_patient_context(context: dict[str, str | None]) -> str:
    """
    Build patient context string from dictionary.

    Args:
        context (Dict[str, str]): Patient context (name, dob, gender, etc.).

    Returns:
        str: A formatted patient context string.
    """
    context_parts = []
    if context.get("name"):
        context_parts.append(f"Patient name: {context['name']}")
    if context.get("age"):
        context_parts.append(f"Age: {context['age']}")
    if context.get("gender"):
        context_parts.append(f"Gender: {context['gender']}")
    if context.get("dob"):
        context_parts.append(f"DOB: {context['dob']}")

    return " ".join(context_parts)
