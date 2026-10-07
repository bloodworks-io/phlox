"""Live-scribe note-edit and artifact-staging tools.

Note tools mutate in-memory LiveSession state directly; stage_artifact hits
the PDF form store and stage_letter calls the letter pipeline. Definitions
follow the same OpenAI function format as the chat tool registry so they can
be merged into one tools list.
"""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def get_live_tools_definition() -> list[dict[str, Any]]:
    """Tool definitions for the live scribe agent (note edits + staging)."""
    return [
        {
            "type": "function",
            "function": {
                "name": "get_note_fields",
                "description": (
                    "Read the current live note fields: each field's key, name, "
                    "current content, and whether the clinician has manually "
                    "edited it. Call this before editing if you are unsure of "
                    "the current content."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "update_note_field",
                "description": (
                    "Replace the full content of a note field with new content. "
                    "Use when substantially restructuring a field. Provide the "
                    "complete new content (existing content is discarded). "
                    "Respects clinician-authored fields in live mode: if the "
                    "clinician edited the field you will be told to append "
                    "instead."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "field_key": {
                            "type": "string",
                            "description": "The field_key of the note field to update",
                        },
                        "content": {
                            "type": "string",
                            "description": "The complete new content for the field",
                        },
                        "format": {
                            "type": ["string", "null"],
                            "description": (
                                "Set ONLY when the clinician asks to change the "
                                "field's format: 'narrative' for flowing prose, "
                                "'list' for the template's list style. Omit "
                                "otherwise."
                            ),
                        },
                    },
                    "required": ["field_key", "content", "format"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "append_to_field",
                "description": (
                    "Append one entry (e.g. a bullet or numbered item) to the "
                    "end of a note field, keeping existing content. Preferred "
                    "for incremental capture during the consultation."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "field_key": {
                            "type": "string",
                            "description": "The field_key of the note field to append to",
                        },
                        "entry": {
                            "type": "string",
                            "description": (
                                "The entry to append, without leading bullet or "
                                "number (formatting is matched automatically)"
                            ),
                        },
                    },
                    "required": ["field_key", "entry"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "remove_from_field",
                "description": (
                    "Remove a mention from a note field: deletes the sentence(s) "
                    "containing the given phrase. Use for spoken tidy-up commands "
                    'like "don\'t mention their dog died".'
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "field_key": {
                            "type": "string",
                            "description": "The field_key of the note field to edit",
                        },
                        "phrase": {
                            "type": "string",
                            "description": "A short phrase identifying the sentence(s) to remove (e.g. 'dog died')",
                        },
                    },
                    "required": ["field_key", "phrase"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "stage_artifact",
                "description": (
                    "Stage a PDF form artifact for the clinician to review at the "
                    "end of the visit (e.g. a PET scan request form). Validates "
                    "the template and required fields; the filled PDF is prepared "
                    "client-side from the staged values."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "template_id": {
                            "type": "string",
                            "description": "ID of the PDF form template (from list_pdf_form_templates)",
                        },
                        "field_values": {
                            "type": "object",
                            "description": "Values for the form fields, keyed by field name",
                            "additionalProperties": {"type": "string"},
                        },
                    },
                    "required": ["template_id", "field_values"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_letter_templates",
                "description": (
                    "List the letter templates available to this clinician, "
                    "marking the default. Call before stage_letter when "
                    "unsure which template name to use."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "stage_letter",
                "description": (
                    "Draft a letter (e.g. to the GP or a referrer) from the "
                    "current note fields and stage it for the clinician to "
                    "review. If a letter is already staged, the new draft "
                    "refines it, so include the clinician's request in "
                    "'instruction'."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "template_name": {
                            "type": ["string", "null"],
                            "description": (
                                "Letter template by name (from "
                                "list_letter_templates). Omit for the "
                                "clinician's default template."
                            ),
                        },
                        "instruction": {
                            "type": ["string", "null"],
                            "description": (
                                "What the clinician asked the letter to cover "
                                "or change (e.g. 'mention the DOAC switch')"
                            ),
                        },
                    },
                    "required": ["template_name", "instruction"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "save_letter",
                "description": (
                    "Save the currently staged letter to the patient's "
                    "encounter. Only call this when the clinician explicitly "
                    "asks to save the letter. Saves the staged draft verbatim "
                    "— it takes no content."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_jobs",
                "description": (
                    "Read the wrap-up job list. The list is generated by the "
                    "standard extraction pipeline when the clinician opens Wrap "
                    "Up, and checked items are saved as jobs. Returns a hint if "
                    "wrap-up has not been opened yet."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "set_jobs",
                "description": (
                    "Replace the wrap-up job list, e.g. for spoken curation like "
                    "\"just keep the 'email CDU' job\". Provide the complete list; "
                    "only checked items are saved. The clinician sees the "
                    "checkboxes update live and still confirms with a button."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "jobs": {
                            "type": "array",
                            "description": "The full replacement job list",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "text": {
                                        "type": "string",
                                        "description": "The job description",
                                    },
                                    "checked": {
                                        "type": "boolean",
                                        "description": "Whether the job should be kept/saved",
                                    },
                                },
                                "required": ["text", "checked"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["jobs"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "wrap_up",
                "description": (
                    "Open the clinician's wrap-up flow when they clearly signal "
                    'the visit is ending (e.g. "that\'s everything", "let\'s wrap '
                    'up"). Jobs are then extracted from the plan by the standard '
                    "pipeline and you switch to tidy mode for spoken note edits."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
    ]


# Detects the leading list marker of a field entry ("• ", "1. ", "- ").
_ENTRY_MARKER = re.compile(r"^\s*(?:[•\-\*]|\d+[.)])\s+")
_NUMBER_MARKER = re.compile(r"\d+[.)]")
_LIST_FORMATS = {"list", "narrative"}


def _field_names(session) -> dict[str, str]:
    return {
        field.get("field_key", "?"): field.get("field_name", field.get("field_key", "?"))
        for field in session.template_fields
    }


def _seed_marker(field: dict[str, Any]) -> str | None:
    """List marker from the style example; line 1 only, so heading-led
    styles (heading_with_bullets, narrative, lab_values) yield None."""
    example = (field.get("style_example") or "").strip()
    if not example:
        return None
    match = _ENTRY_MARKER.match(example.splitlines()[0])
    return match.group(0).strip() if match else None


def _list_seed(session, key: str) -> str | None:
    """Marker to enforce; format overrides and clinician edits beat the template."""
    declared = session.field_formats.get(key)
    if declared == "narrative":
        return None
    if declared != "list" and key in session.user_touched:
        return None
    for field in session.template_fields:
        if field.get("field_key") == key:
            return _seed_marker(field)
    return None


def _numbered(seed: str) -> bool:
    return bool(_NUMBER_MARKER.fullmatch(seed))


def _normalise_entry(existing: str, entry: str, seed: str | None = None) -> str:
    """Marker from the last existing line, else the field seed, else plain newline."""
    entry = entry.strip()
    lines = [line for line in existing.strip().splitlines() if line.strip()]
    sep = "" if not lines or existing.endswith("\n") else "\n"
    marker_match = _ENTRY_MARKER.match(lines[-1]) if lines else None
    if marker_match or seed:
        # Drop the entry's own marker when we prepend one, or numbered
        # fields accumulate "4. 4. ..." doubles.
        entry = _ENTRY_MARKER.sub("", entry, count=1).strip() or entry
    if marker_match:
        marker = marker_match.group(0).strip()
        if _numbered(marker):
            number = int(marker.rstrip(".)")) + 1
            closing = ")" if marker.endswith(")") else "."
            return f"{sep}{number}{closing} {entry}"
        return f"{sep}{marker} {entry}"
    if seed:
        if _numbered(seed):
            # Content drifted bare: treat each existing line as an item.
            number = len(lines) + 1
            closing = ")" if seed.endswith(")") else "."
            return f"{sep}{number}{closing} {entry}"
        return f"{sep}{seed} {entry}"
    return f"{sep}{entry}"


def _apply_seed_markers(content: str, seed: str | None) -> str:
    """Apply the seed marker to a full rewrite; numbered seeds renumber 1..n."""
    if not seed or not content.strip():
        return content
    if not _numbered(seed):
        return "\n".join(
            line if not line.strip() or _ENTRY_MARKER.match(line) else f"{seed} {line.strip()}"
            for line in content.splitlines()
        )
    closing = ")" if seed.endswith(")") else "."
    number = 0
    out_lines = []
    for line in content.splitlines():
        if not line.strip():
            continue
        number += 1
        text = _ENTRY_MARKER.sub("", line, count=1).strip()
        out_lines.append(f"{number}{closing} {text}")
    return "\n".join(out_lines)


def _remove_sentences(content: str, phrase: str) -> tuple[str, bool]:
    """Remove sentence(s) containing a fuzzy match of phrase. Returns (new, changed)."""
    if not content or not phrase:
        return content, False

    out_lines = []
    changed = False
    words = [w.lower() for w in re.findall(r"\w+", phrase)]
    if not words:
        return content, False

    for line in content.splitlines():
        if not line.strip():
            out_lines.append(line)
            continue
        # Keep the leading list marker when the item text is dropped.
        marker_match = _ENTRY_MARKER.match(line)
        prefix = marker_match.group(0) if marker_match else ""
        body = line[marker_match.end() :] if marker_match else line
        sentences = re.split(r"(?<=[.!?])\s+", body)
        kept = []
        for sentence in sentences:
            sentence_words = [w.lower() for w in re.findall(r"\w+", sentence)]
            # Fuzzy containment: all phrase words appear in the sentence.
            if all(any(pw == sw for sw in sentence_words) for pw in words):
                changed = True
                continue  # drop this sentence
            kept.append(sentence)
        if kept:
            out_lines.append(prefix + " ".join(kept))
        else:
            changed = True  # whole line removed
    if not changed:
        return content, False
    return "\n".join(out_lines).strip("\n"), True


async def execute_live_tool(session, name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Execute a live-scribe tool against session state.

    Returns ``{"content": str, "events": [event, ...]}`` where content is the
    tool-result text for the LLM and events are SSE events to emit.
    """
    fields = _field_names(session)

    if name == "get_note_fields":
        lines = []
        for key, field_name in fields.items():
            content = session.field_drafts.get(key, "")
            touched = " [clinician-edited]" if key in session.user_touched else ""
            preview = content if len(content) <= 300 else content[:300] + "..."
            lines.append(f"{key} ({field_name}){touched}: {preview or '(empty)'}")
        return {"content": "\n".join(lines) or "No fields defined.", "events": []}

    if name == "update_note_field":
        key = args.get("field_key", "")
        content = str(args.get("content", ""))
        fmt = args.get("format")
        if key not in fields:
            return {"content": _unknown_field_error(key, fields), "events": []}
        if session.mode == "live" and key in session.user_touched:
            return {
                "content": (
                    f"The clinician manually edited '{key}'. Do not overwrite it; "
                    "use append_to_field to add to it instead."
                ),
                "events": [],
            }
        if fmt in _LIST_FORMATS:
            session.field_formats[key] = fmt
        content = _apply_seed_markers(content, _list_seed(session, key))
        session.field_drafts[key] = content.strip()
        return {
            "content": f"Field '{key}' updated.",
            "events": [
                {"type": "field_update", "field_key": key, "content": session.field_drafts[key]}
            ],
        }

    if name == "append_to_field":
        key = args.get("field_key", "")
        entry = str(args.get("entry", "")).strip()
        if not entry:
            return {"content": "Nothing to append (empty entry).", "events": []}
        if key not in fields:
            return {"content": _unknown_field_error(key, fields), "events": []}
        existing = session.field_drafts.get(key, "")
        session.field_drafts[key] = (
            f"{existing}{_normalise_entry(existing, entry, _list_seed(session, key))}"
        )
        return {
            "content": f"Appended to '{key}'.",
            "events": [
                {"type": "field_update", "field_key": key, "content": session.field_drafts[key]}
            ],
        }

    if name == "remove_from_field":
        key = args.get("field_key", "")
        phrase = str(args.get("phrase", ""))
        if key not in fields:
            return {"content": _unknown_field_error(key, fields), "events": []}
        existing = session.field_drafts.get(key, "")
        new_content, changed = _remove_sentences(existing, phrase)
        if not changed:
            return {
                "content": f"Phrase '{phrase}' not found in '{key}'. No change made.",
                "events": [],
            }
        # Close the numbering gap left by the removed item.
        seed = _list_seed(session, key)
        if seed and _numbered(seed):
            new_content = _apply_seed_markers(new_content, seed)
        session.field_drafts[key] = new_content
        return {
            "content": f"Removed mention of '{phrase}' from '{key}'.",
            "events": [{"type": "field_update", "field_key": key, "content": new_content}],
        }

    if name == "stage_artifact":
        return await _stage_artifact(session, args)

    if name == "list_letter_templates":
        return _list_letter_templates()

    if name == "stage_letter":
        return await _stage_letter(session, args)

    if name == "save_letter":
        return _save_letter(session)

    if name == "get_jobs":
        if not session.staged_jobs:
            return {
                "content": (
                    "No job list yet — it is generated when the clinician opens "
                    "Wrap Up. If the visit is ending, call wrap_up to open it."
                ),
                "events": [],
            }
        listing = "\n".join(
            f"- [{'x' if job.get('checked') else ' '}] {job.get('text', '')}"
            for job in session.staged_jobs
        )
        return {
            "content": ("Wrap-up job list (checked items are saved at confirm):\n" + listing),
            "events": [],
        }

    if name == "set_jobs":
        jobs_arg = args.get("jobs") or []
        cleaned: list[dict[str, Any]] = []
        for item in jobs_arg:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text", "")).strip()
            if text:
                cleaned.append({"text": text, "checked": bool(item.get("checked", True))})
        session.staged_jobs = cleaned
        return {
            "content": f"Job list updated ({len(cleaned)} item(s)).",
            "events": [{"type": "jobs_staged", "jobs": cleaned}],
        }

    if name == "wrap_up":
        return {
            "content": "Opening the wrap-up flow for the clinician.",
            "events": [{"type": "request_wrap_up"}],
        }

    return {"content": f"Unknown live tool '{name}'.", "events": []}


def _unknown_field_error(key: str, fields: dict[str, str]) -> str:
    return f"Unknown field_key '{key}'. Valid keys: {', '.join(fields.keys())}."


async def _stage_artifact(session, args: dict[str, Any]) -> dict[str, Any]:
    template_id = str(args.get("template_id", ""))
    field_values = args.get("field_values") or {}
    field_values = {str(k): str(v) for k, v in field_values.items()}

    try:
        from server.pdf_forms.storage import PDFFormStore

        store = PDFFormStore()
        template = store.get_template(template_id)
    except Exception as exc:  # store unavailable / db error
        logger.error("stage_artifact: store error: %s", exc)
        return {"content": f"Error staging form: {exc}", "events": []}

    if template is None:
        return {
            "content": (
                f"Template '{template_id}' not found. Use list_pdf_form_templates to see valid IDs."
            ),
            "events": [],
        }

    missing = [
        field["name"]
        for field in template.get("fields", [])
        if field.get("required") and not field_values.get(field["name"])
    ]
    if missing:
        return {
            "content": f"Missing required fields: {', '.join(missing)}.",
            "events": [],
        }

    artifact = {
        "type": "form_fill",
        "template_id": template_id,
        "template_name": template["name"],
        "field_values": field_values,
        "fields": template.get("fields", []),
        "staged": True,
    }
    session.staged_artifacts.append(artifact)
    return {
        "content": f"Staged form '{template['name']}' for the clinician to review at wrap-up.",
        "events": [{"type": "artifact_staged", "artifact": artifact}],
    }


def _list_letter_templates() -> dict[str, Any]:
    try:
        from server.database.config.manager import config_manager
        from server.database.repositories.letter import get_letter_templates

        templates = get_letter_templates()
        default_id = config_manager.get_user_settings().get("default_letter_template_id")
    except Exception as exc:
        logger.error("list_letter_templates: error: %s", exc)
        return {"content": f"Error fetching letter templates: {exc}", "events": []}

    if not templates:
        return {"content": "No letter templates available yet.", "events": []}

    lines = [
        f"- {t.get('name', '')}{' (default)' if t.get('id') == default_id else ''}"
        for t in templates
    ]
    return {
        "content": "Available letter templates:\n" + "\n".join(lines),
        "events": [],
    }


async def _stage_letter(session, args: dict[str, Any]) -> dict[str, Any]:
    template_name = str(args.get("template_name") or "").strip()
    instruction = str(args.get("instruction") or "").strip()

    try:
        from server.database.config.manager import config_manager
        from server.database.repositories.letter import get_letter_templates

        templates = get_letter_templates()
    except Exception as exc:
        logger.error("stage_letter: template fetch error: %s", exc)
        return {"content": f"Error fetching letter templates: {exc}", "events": []}

    template = None
    if template_name:
        lowered = template_name.casefold()
        template = next(
            (t for t in templates if str(t.get("name", "")).casefold() == lowered),
            None,
        )
        if template is None:
            names = ", ".join(str(t.get("name", "")) for t in templates) or "(none)"
            return {
                "content": (f"Letter template '{template_name}' not found. Available: {names}."),
                "events": [],
            }
    else:
        default_id = config_manager.get_user_settings().get("default_letter_template_id")
        template = next((t for t in templates if t.get("id") == default_id), None)

    additional = str((template or {}).get("instructions") or "")
    if instruction:
        additional = f"{additional}\n\n{instruction}".strip()

    # A staged letter makes this a refinement pass.
    prior = next((a for a in session.staged_artifacts if a.get("type") == "letter"), None)
    context = None
    if prior is not None:
        context = [
            {"role": "assistant", "content": str(prior.get("content") or "")},
            {"role": "user", "content": instruction or "Refine this letter."},
        ]

    try:
        from server.nlp_tools.letter import generate_letter_content

        result = await generate_letter_content(
            patient_name=str(session.patient_context.get("name") or ""),
            gender=str(session.patient_context.get("gender") or ""),
            dob=str(session.patient_context.get("dob") or ""),
            template_data=dict(session.field_drafts),
            additional_instruction=additional or None,
            context=context,
        )
    except Exception as exc:
        logger.error("stage_letter: generation error: %s", exc)
        return {"content": f"Error generating letter: {exc}", "events": []}

    title = str((template or {}).get("name") or "Letter")
    artifact = {
        "type": "letter",
        "title": title,
        "content": result.get("letter", ""),
        "staged": True,
    }
    session.staged_artifacts = [
        a for a in session.staged_artifacts if a.get("type") != "letter"
    ] + [artifact]
    verb = "refined" if prior is not None else "drafted"
    return {
        "content": f"Letter '{title}' {verb} and staged for the clinician to review.",
        "events": [{"type": "artifact_staged", "artifact": artifact}],
    }


def _save_letter(session) -> dict[str, Any]:
    letter = next((a for a in session.staged_artifacts if a.get("type") == "letter"), None)
    if letter is None:
        return {
            "content": "No staged letter to save. Draft one with stage_letter first.",
            "events": [],
        }
    if not session.note_id:
        return {
            "content": (
                "The encounter isn't saved yet, so there's nowhere to store "
                "the letter. Ask the clinician to save the encounter first."
            ),
            "events": [],
        }

    try:
        from server.database.repositories.letter import update_patient_letter

        updated = update_patient_letter(session.note_id, str(letter.get("content") or ""))
        if not updated:
            logger.error("save_letter: no row updated for note %s", session.note_id)
            return {
                "content": "Could not save the letter: the encounter was not found.",
                "events": [],
            }
    except Exception as exc:
        logger.error("save_letter: error: %s", exc)
        return {"content": f"Error saving letter: {exc}", "events": []}

    letter["saved"] = True
    return {
        "content": "Letter saved to the encounter.",
        "events": [
            {"type": "letter_saved", "note_id": session.note_id},
            {"type": "artifact_staged", "artifact": letter},
        ],
    }
