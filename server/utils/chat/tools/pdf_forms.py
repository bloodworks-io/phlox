"""Chat tool handlers for PDF form templates.

Two tools:
  - ``list_pdf_form_templates`` — returns available templates and their fields.
  - ``fill_pdf_form`` — validates values and returns a ``form_fill`` artifact
    that the frontend uses to fill the PDF client-side via pdf-lib.
"""

import contextlib
import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from server.utils.chat.streaming.response import (
    artifact_message,
    end_message,
    status_message,
)

logger = logging.getLogger(__name__)


def _get_store():
    from server.utils.pdf_forms.storage import PDFFormStore

    return PDFFormStore()

async def list_templates(
    _tool_call: dict[str, Any],
    _llm_client,
    _config: dict[str, Any],
    _message_list: list,
    _context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Return a summary of all PDF form templates with their fields."""
    yield status_message("Looking up PDF form templates...")

    try:
        store = _get_store()
        templates = store.list_templates()

        if not templates:
            content = "No PDF form templates have been created yet."
        else:
            lines = ["Available PDF form templates:"]
            for tmpl in templates:
                lines.append(f"\n  **{tmpl['name']}** (ID: {tmpl['id']})")
                lines.append(
                    f"  Pages: {tmpl['page_count']} | Fields: {tmpl.get('field_count', 0)}"
                )
                if tmpl.get("description"):
                    lines.append(f"  {tmpl['description']}")

                # Fetch full template to list fields
                full = store.get_template(tmpl["id"])
                if full and full.get("fields"):
                    for field in full["fields"]:
                        req = " (required)" if field.get("required") else ""
                        lines.append(f"    - {field['name']}: {field['field_type']}{req}")

            content = "\n".join(lines)

    except Exception as exc:
        logger.error("list_pdf_form_templates error: %s", exc)
        content = f"Error listing templates: {exc}"

    yield end_message(function_response={"content": content, "citations": []})

async def fill_form(
    tool_call: dict[str, Any],
    _llm_client,
    _config: dict[str, Any],
    _message_list: list,
    _context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Validate field values and return a form_fill artifact for the frontend."""

    # Parse arguments
    function_arguments = {}
    if "arguments" in tool_call["function"]:
        raw = tool_call["function"]["arguments"]
        if isinstance(raw, str):
            with contextlib.suppress(json.JSONDecodeError):
                function_arguments = json.loads(raw)
        else:
            function_arguments = raw

    template_id = function_arguments.get("template_id", "")
    field_values = function_arguments.get("field_values", {})

    yield status_message("Preparing PDF form...")

    try:
        store = _get_store()
        template = store.get_template(template_id)

        if template is None:
            yield end_message(
                function_response={
                    "content": f"Template '{template_id}' not found.",
                    "citations": [],
                }
            )
            return

        # Validate required fields
        missing = []
        for field in template.get("fields", []):
            if field.get("required") and not field_values.get(field["name"]):
                missing.append(field["name"])

        if missing:
            yield end_message(
                function_response={
                    "content": (
                        f"Missing required fields: {', '.join(missing)}. "
                        "Please provide values for all required fields."
                    ),
                    "citations": [],
                }
            )
            return

        # Return a form_fill artifact — the frontend fills the PDF client-side
        yield artifact_message(
            {
                "type": "form_fill",
                "template_id": template_id,
                "template_name": template["name"],
                "field_values": field_values,
                "fields": template.get("fields", []),
            }
        )

        filled_fields = ", ".join(f"{k}={v}" for k, v in field_values.items())
        content = (
            f"Filled form **{template['name']}** with the following values:\n"
            f"{filled_fields}\n\n"
            "The completed PDF is ready for download."
        )

        yield end_message(function_response={"content": content, "citations": []})

    except Exception as exc:
        logger.error("fill_pdf_form error: %s", exc)
        yield end_message(
            function_response={
                "content": f"Error filling form: {exc}",
                "citations": [],
            }
        )
