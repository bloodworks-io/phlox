"""API router for PDF form template management."""

import asyncio
import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from server.database.config.manager import config_manager
from server.llm_client.client import get_llm_client
from server.pdf_forms.storage import PDFFormStore
from server.schemas.pdf_forms import DetectFieldsRequest, UpdateFieldsRequest
from server.utils.current_user import require_admin

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
    require_admin()
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
        raise HTTPException(
            status_code=400, detail="page_heights must be a valid JSON array"
        ) from exc

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
def list_templates():
    """List all form templates (without PDF data)."""
    return _get_store().list_templates()


@router.get("/templates/{template_id}")
def get_template(template_id: str):
    """Get a template with its field definitions."""
    template = _get_store().get_template(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.delete("/templates/{template_id}")
def delete_template(template_id: str):
    """Delete a template and all its fields. Admin only."""
    require_admin()
    if not _get_store().delete_template(template_id):
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "deleted"}


@router.get("/templates/{template_id}/pdf")
def get_template_pdf(template_id: str):
    """Serve the raw PDF for a template."""
    pdf_data = _get_store().get_template_pdf(template_id)
    if pdf_data is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="template.pdf"'},
    )


@router.put("/templates/{template_id}/pdf")
async def replace_template_pdf(
    template_id: str,
    pdf: UploadFile = File(...),
    page_count: int = Form(...),
    page_heights: str = Form("[]"),
):
    """Replace a template's PDF while keeping its field definitions.

    The replacement must have identical page geometry.
    """
    require_admin()
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
        raise HTTPException(
            status_code=400, detail="page_heights must be a valid JSON array"
        ) from exc

    store = _get_store()
    existing = store.get_template(template_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Template not found")

    if existing["page_count"] != page_count or existing["page_heights"] != heights:
        raise HTTPException(
            status_code=422,
            detail=(
                "Replacement PDF must match the original page geometry: expected "
                f"{existing['page_count']} page(s) with heights {existing['page_heights']}, "
                f"got {page_count} page(s) with heights {heights}."
            ),
        )

    updated = store.replace_pdf(
        template_id=template_id,
        pdf_file_name=pdf.filename,
        pdf_data=pdf_data,
        page_count=page_count,
        page_heights=heights,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return updated


@router.put("/templates/{template_id}/fields")
def update_fields(template_id: str, body: UpdateFieldsRequest):
    """Replace all field definitions for a template. Admin only."""
    require_admin()
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
    "You are a form field detection assistant. You are given a rendered image of "
    "a PDF form page. Identify every fillable "
    "form field (text inputs, checkboxes, date fields, number fields). For each "
    "field provide:\n"
    "- name: the printed label of the field\n"
    "- field_type: one of text, checkbox, date, or number\n"
    "- page_number: the page number (starting from 1)\n"
    "- x_pct: left edge of the fillable region as a percentage of page width (0–100)\n"
    "- y_pct: top edge of the fillable region as a percentage of page height (0–100)\n"
    "- width_pct: width of the fillable region as a percentage of page width\n"
    "- height_pct: height of the fillable region as a percentage of page height\n\n"
    "Locate the bounding box of the region the user would fill in — the input box, "
    "underline, or empty cell — NOT its printed label. Estimate positions as "
    "precisely as possible using fractional percentages; do not round to "
    "multiples of 5 or 10. Return a JSON object with a 'fields' array."
)


@router.post("/templates/{template_id}/detect-fields")
async def detect_fields(template_id: str, body: DetectFieldsRequest):  # noqa: ARG001
    """Use a vision model to detect form fields from PDF page images."""
    # One fresh request per page — many providers cap images per prompt and
    # per conversation context, so pages must never share a request.
    config = config_manager.get_config()
    prompts = config_manager.get_prompts_and_options()
    options = prompts["options"]["general"].copy()
    options.pop("stop", None)
    client = get_llm_client(timeout=180)

    async def detect_page(page):
        messages = [
            {"role": "system", "content": _DETECT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Identify all fillable form fields on this page.",
                    },
                    {"type": "image_url", "image_url": {"url": page.data_url}},
                ],
            },
        ]
        raw = await client.chat_with_structured_output(
            model=config["PRIMARY_MODEL"],
            messages=messages,
            schema=_DETECT_FIELDS_SCHEMA,
            options=options,
        )
        result = json.loads(raw) if isinstance(raw, str) else raw
        # Page is ground truth from the request, not the model
        for field in result.get("fields", []):
            field["page_number"] = page.page_number
        return result.get("fields", [])

    valid_pages = [
        page for page in body.pages if page.data_url.startswith("data:image/")
    ]
    if not valid_pages:
        raise HTTPException(status_code=400, detail="No valid image data URLs supplied")

    results = await asyncio.gather(
        *(detect_page(page) for page in valid_pages), return_exceptions=True
    )

    fields: list[dict] = []
    last_error: Exception | None = None
    for page, result in zip(valid_pages, results, strict=True):
        if isinstance(result, BaseException):
            last_error = result
            logger.error(
                "VLM field detection failed for page %s: %s",
                page.page_number,
                result,
            )
            continue
        fields.extend(result)

    if not fields and last_error is not None:
        raise HTTPException(
            status_code=502, detail=f"Vision model error: {last_error}"
        ) from last_error

    return {"fields": fields}
