"""F9: decompression-bomb defenses — body size cap, PDF page/char caps, pixel cap."""

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from server.middleware import RequestBodyLimitMiddleware


def _build_upload_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestBodyLimitMiddleware)

    @app.post("/api/rag/extract-pdf-info")
    async def _upload(request: Request):
        return {"size": len(await request.body())}

    @app.post("/api/transcribe/audio")
    async def _audio(request: Request):
        return {"size": len(await request.body())}

    return app


@pytest.fixture()
def client(monkeypatch):
    import server.constants as constants

    monkeypatch.setattr(constants, "MAX_BODY_BYTES", 1000)
    monkeypatch.setattr(constants, "MAX_AUDIO_BODY_BYTES", 2000)
    return TestClient(_build_upload_app())


def test_oversized_content_length_rejected(client):
    resp = client.post(
        "/api/rag/extract-pdf-info",
        content=b"x" * 1001,
        headers={"Content-Length": "1001"},
    )
    assert resp.status_code == 413


def test_oversized_streamed_body_rejected_without_content_length(client):
    # Generator body -> httpx streams it (no Content-Length); the receive-counter must catch it
    resp = client.post("/api/rag/extract-pdf-info", content=iter([b"x" * 1001]))
    assert resp.status_code == 413


def test_body_under_limit_passes(client):
    assert client.post("/api/rag/extract-pdf-info", content=b"x" * 100).json() == {"size": 100}


def test_audio_paths_get_higher_cap(client):
    assert client.post("/api/transcribe/audio", content=b"x" * 1500).json() == {"size": 1500}
    assert client.post("/api/transcribe/audio", content=b"x" * 2001).status_code == 413


def test_get_requests_unaffected(client):
    assert client.get("/api/rag/extract-pdf-info").status_code in (405, 404)


# --- capped PDF extraction ------------------------------------------------------


class _FakePage:
    def __init__(self, text: str):
        self._text = text

    def extract_text(self):
        return self._text


def _patch_fake_reader(monkeypatch, pages):
    from server.nlp_tools import document_processing as dp

    class _FakeReader:
        def __init__(self, _buf):
            self.pages = pages

    monkeypatch.setattr(dp, "PdfReader", _FakeReader)
    return dp


def test_pdf_extraction_stops_at_page_cap(monkeypatch):
    from server.nlp_tools import document_processing as dp

    if not dp.PDF_TEXT_AVAILABLE:
        pytest.skip("pypdf not installed")
    monkeypatch.setattr(dp, "PDF_MAX_PAGES", 3)
    monkeypatch.setattr(dp, "PDF_MAX_TEXT_CHARS", 10_000_000)
    pages = [_FakePage("text") for _ in range(50)]
    dp_ref = _patch_fake_reader(monkeypatch, pages)

    result = dp_ref.extract_pdf_text_capped(b"fake")
    assert result.count("text") == 3  # stopped at the cap, not all 50 pages


def test_pdf_extraction_stops_at_char_cap(monkeypatch):
    from server.nlp_tools import document_processing as dp

    if not dp.PDF_TEXT_AVAILABLE:
        pytest.skip("pypdf not installed")
    monkeypatch.setattr(dp, "PDF_MAX_PAGES", 1000)
    monkeypatch.setattr(dp, "PDF_MAX_TEXT_CHARS", 10)
    pages = [_FakePage("a" * 6) for _ in range(20)]
    dp_ref = _patch_fake_reader(monkeypatch, pages)

    result = dp_ref.extract_pdf_text_capped(b"fake")
    # Cap hit on page 2 (6+2+6 chars); page 3+ never parsed (would be 6*20 + 2*19)
    assert len(result) == 14


def test_pillow_pixel_cap_is_set():
    from server.nlp_tools import document_processing as dp

    if not dp.OCR_AVAILABLE:
        pytest.skip("OCR dependencies not installed")
    from PIL import Image

    assert Image.MAX_IMAGE_PIXELS == 40_000_000
