"""
Tests for the PDF form template "replace PDF, keep fields" path.
"""

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from server.api.pdf_forms import router as pdf_forms_router

app = FastAPI()
app.include_router(pdf_forms_router, prefix="/api/pdf-forms")
client = TestClient(app)

# Minimal bytes — the route validates filename + size only, never parses the PDF.
_PDF_BYTES = b"%PDF-1.4\n%replace-test\n%%EOF"


def _create_template(name: str = "t", page_count: int = 1, heights: list | None = None):
    heights = heights if heights is not None else [792.0]
    resp = client.post(
        "/api/pdf-forms/templates",
        data={
            "name": name,
            "page_count": str(page_count),
            "page_heights": __import__("json").dumps(heights),
        },
        files={"pdf": ("a.pdf", _PDF_BYTES, "application/pdf")},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _add_field(template_id: str):
    resp = client.put(
        f"/api/pdf-forms/templates/{template_id}/fields",
        json={
            "fields": [
                {
                    "name": "First",
                    "field_type": "text",
                    "page_number": 1,
                    "x": 10.0,
                    "y": 10.0,
                    "width": 100.0,
                    "height": 20.0,
                }
            ]
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["fields"][0]


def test_replace_pdf_keeps_fields():
    tmpl = _create_template()
    _add_field(tmpl["id"])

    new_bytes = b"%PDF-1.4\n%new\n%%EOF"
    resp = client.put(
        f"/api/pdf-forms/templates/{tmpl['id']}/pdf",
        data={
            "page_count": str(tmpl["page_count"]),
            "page_heights": __import__("json").dumps(tmpl["page_heights"]),
        },
        files={"pdf": ("replacement.pdf", new_bytes, "application/pdf")},
    )
    assert resp.status_code == 200, resp.text
    updated = resp.json()
    assert updated["pdf_file_name"] == "replacement.pdf"
    assert len(updated["fields"]) == 1
    assert updated["fields"][0]["name"] == "First"


def test_replace_pdf_dimension_mismatch_422():
    tmpl = _create_template(page_count=1, heights=[792.0])
    _add_field(tmpl["id"])

    resp = client.put(
        f"/api/pdf-forms/templates/{tmpl['id']}/pdf",
        data={
            "page_count": "2",
            "page_heights": __import__("json").dumps([792.0, 792.0]),
        },
        files={"pdf": ("replacement.pdf", _PDF_BYTES, "application/pdf")},
    )
    assert resp.status_code == 422, resp.text


def test_replace_pdf_missing_template_404():
    resp = client.put(
        "/api/pdf-forms/templates/does-not-exist/pdf",
        data={"page_count": "1", "page_heights": "[792.0]"},
        files={"pdf": ("replacement.pdf", _PDF_BYTES, "application/pdf")},
    )
    assert resp.status_code == 404, resp.text


# --- access control: writes are admin-only, reads stay clinic-shared ---------


def _fake_upload():
    """A real Starlette UploadFile; the handlers never parse the PDF."""
    import io

    from starlette.datastructures import UploadFile

    return UploadFile(file=io.BytesIO(b"%PDF-1.4"), filename="x.pdf")


@pytest.mark.usefixtures("clinician_ctx")
def test_pdf_form_writes_require_admin():
    from server.api.pdf_forms import delete_template, update_fields
    from server.schemas.pdf_forms import UpdateFieldsRequest

    with pytest.raises(HTTPException) as exc:
        delete_template("any-id")
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        update_fields("any-id", UpdateFieldsRequest(fields=[]))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
@pytest.mark.usefixtures("clinician_ctx")
async def test_pdf_form_uploads_require_admin():
    from server.api.pdf_forms import create_template, replace_template_pdf

    with pytest.raises(HTTPException) as exc:
        await create_template(name="t", pdf=_fake_upload(), page_count=1, page_heights="[792.0]")
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        await replace_template_pdf(
            "any-id", pdf=_fake_upload(), page_count=1, page_heights="[792.0]"
        )
    assert exc.value.status_code == 403


@pytest.mark.usefixtures("clinician_ctx")
def test_pdf_form_reads_stay_shared():
    from server.api.pdf_forms import get_template, list_templates

    # Reads are clinic-shared: reachable (and 404, not 403, for unknown ids)
    assert isinstance(list_templates(), list)
    with pytest.raises(HTTPException) as exc:
        get_template("no-such-template")
    assert exc.value.status_code == 404
