"""API router for PDF form template management."""

import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from server.database.config.manager import config_manager
from server.schemas.pdf_forms import DetectFieldsRequest, UpdateFieldsRequest
from server.utils.llm_client.client import get_llm_client
from server.utils.pdf_forms.storage import PDFFormStore

router = APIRouter()

logger = logging.getLogger(__name__)

_store: PDFFormStore | None = None


def _get_store() -> PDFFormStore:
    """Lazy-init the store singleton."""
    global _store
    if _store is None:
        _store = PDFFormStore()
    return _store


@router.post("/templates")
async def create_template(
    name: str = Form(...),
    pdf: UploadFile = File(...),
    description: str = Form(""),
    page_count: int = Form(...),
    page_heights: str = Form("[]"),
):
    """Upload a PDF and create a form template.

    Page metadata (count, heights) is extracted by the frontend via pdfjs-dist before uploading.
    Something of an anti-pattern but helps to avoid issues with bundling PyMuPDF for Tauri builds etc.
    """
    if not pdf.filename or not pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_data = await pdf.read()
    if len(pdf_data) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF file too large (max 50 MB)")

    if page_count <= 0:
        raise HTTPException(
            status_code=400,
            detail="page_count must be a positive integer (extracted by frontend)",
        )

    try:
        heights = json.loads(page_heights)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="page_heights must be a valid JSON array") from exc

    store = _get_store()
    template = store.create_template(
        name=name,
        pdf_file_name=pdf.filename,
        pdf_data=pdf_data,
        page_count=page_count,
        page_heights=heights,
        description=description,
    )
    return template


@router.get("/templates")
async def list_templates():
    """List all form templates (without PDF data)."""
    return _get_store().list_templates()


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    """Get a template with its field definitions."""
    template = _get_store().get_template(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    """Delete a template and all its fields."""
    if not _get_store().delete_template(template_id):
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "deleted"}


@router.get("/templates/{template_id}/pdf")
async def get_template_pdf(template_id: str):
    """Serve the raw PDF for a template."""
    pdf_data = _get_store().get_template_pdf(template_id)
    if pdf_data is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="template.pdf"'},
    )


@router.put("/templates/{template_id}/fields")
async def update_fields(template_id: str, body: UpdateFieldsRequest):
    """Replace all field definitions for a template."""
    try:
        fields = _get_store().update_fields(template_id, [f.model_dump() for f in body.fields])
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"fields": fields}


_DETECT_FIELDS_SCHEMA = {
    "type": "object",
    "properties": {
        "fields": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "field_type": {
                        "type": "string",
                        "enum": ["text", "checkbox", "date", "number"],
                    },
                    "page_number": {"type": "integer"},
                    "x_pct": {
                        "type": "number",
                        "description": "Left edge as % of page width (0–100)",
                    },
                    "y_pct": {
                        "type": "number",
                        "description": "Top edge as % of page height (0–100)",
                    },
                    "width_pct": {"type": "number", "description": "Width as % of page width"},
                    "height_pct": {"type": "number", "description": "Height as % of page height"},
                },
                "required": [
                    "name",
                    "field_type",
                    "page_number",
                    "x_pct",
                    "y_pct",
                    "width_pct",
                    "height_pct",
                ],
            },
        }
    },
    "required": ["fields"],
}

_DETECT_SYSTEM_PROMPT = (
    "You are a form field detection assistant. "
    "Each PDF page image has ruler marks along the top and left edges showing percentage "
    "positions (0% to 100%). Identify all fillable form fields (text inputs, checkboxes, "
    "date fields, number fields). For each field provide:\n"
    "- name: a descriptive label for the field\n"
    "- field_type: one of text, checkbox, date, or number\n"
    "- page_number: the page number (starting from 1)\n"
    "- x_pct: left edge position as a percentage of page width (0–100)\n"
    "- y_pct: top edge position as a percentage of page height (0–100)\n"
    "- width_pct: width as a percentage of page width\n"
    "- height_pct: height as a percentage of page height\n\n"
    "Use the ruler marks as guides to estimate positions. "
    "Return a JSON object with a 'fields' array."
)


@router.post("/templates/{template_id}/detect-fields")
async def detect_fields(template_id: str, body: DetectFieldsRequest):  # noqa: ARG001
    """Use a vision model to detect form fields from grid-overlaid PDF page images."""
    if not body.pages:
        raise HTTPException(status_code=400, detail="No page images supplied")

    # Build image content blocks — label each page so the VLM assigns correct page_number
    user_content: list[dict] = []
    for page in body.pages:
        if not page.data_url.startswith("data:image/"):
            continue
        user_content.append({"type": "text", "text": f"--- Page {page.page_number} ---"})
        user_content.append(
            {
                "type": "image_url",
                "image_url": {"url": page.data_url},
            }
        )

    if not user_content:
        raise HTTPException(status_code=400, detail="No valid image data URLs supplied")

    config = config_manager.get_config()
    prompts = config_manager.get_prompts_and_options()
    options = prompts["options"]["general"].copy()
    options.pop("stop", None)

    messages = [
        {"role": "system", "content": _DETECT_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    client = get_llm_client(timeout=180)
    try:
        raw = await client.chat_with_structured_output(
            model=config["PRIMARY_MODEL"],
            messages=messages,
            schema=_DETECT_FIELDS_SCHEMA,
            options=options,
        )
    except Exception as exc:
        logger.error("VLM field detection failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Vision model error: {exc}") from exc

    # Parse and return
    if isinstance(raw, str):
        result = json.loads(raw)
    else:
        result = raw

    return result
