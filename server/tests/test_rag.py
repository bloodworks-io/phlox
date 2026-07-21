"""
Tests for RAG endpoints.
We mock get_vector_store_manager and VECTOR_STORE_AVAILABLE to simulate vector database interactions.
"""

from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.rag import router as rag_router

app = FastAPI()
app.include_router(rag_router, prefix="/api/rag")
client = TestClient(app)


def _setup_rag_mocks(monkeypatch, mock_vsm: MagicMock):
    """Common setup: enable RAG availability and return a mock vector store manager."""
    monkeypatch.setattr("server.api.rag.VECTOR_STORE_AVAILABLE", True)
    monkeypatch.setattr("server.api.rag.get_vector_store_manager", lambda: mock_vsm)


def test_get_files(monkeypatch):
    mock_vsm = MagicMock()
    mock_vsm.list_collections.return_value = ["disease_a", "disease_b"]
    _setup_rag_mocks(monkeypatch, mock_vsm)

    response = client.get("/api/rag/files")
    assert response.status_code == 200
    data = response.json()
    assert "files" in data
    assert set(data["files"]) == {"disease_a", "disease_b"}


def test_get_collection_files(monkeypatch):
    mock_vsm = MagicMock()
    mock_vsm.get_files_for_collection_with_pdf_flag.return_value = [
        {"filename": "file1", "has_pdf": True},
        {"filename": "file2", "has_pdf": False},
    ]
    _setup_rag_mocks(monkeypatch, mock_vsm)

    response = client.get("/api/rag/collection_files/test_collection")
    assert response.status_code == 200
    data = response.json()
    assert "files" in data
    assert isinstance(data["files"], list)


def test_modify_collection(monkeypatch):
    mock_vsm = MagicMock()
    mock_vsm.modify_collection_name.return_value = True
    _setup_rag_mocks(monkeypatch, mock_vsm)

    payload = {"old_name": "old_collection", "new_name": "new_collection"}
    response = client.post("/api/rag/modify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "renamed successfully" in data.get("message", "").lower()


def test_delete_collection(monkeypatch):
    mock_vsm = MagicMock()
    mock_vsm.delete_collection.return_value = True
    _setup_rag_mocks(monkeypatch, mock_vsm)

    response = client.delete("/api/rag/delete-collection/test_collection")
    assert response.status_code == 200
    data = response.json()
    assert "deleted successfully" in data.get("message", "").lower()


def test_commit_to_vectordb(monkeypatch):
    mock_vsm = MagicMock()
    mock_vsm.commit_to_vectordb.return_value = None
    _setup_rag_mocks(monkeypatch, mock_vsm)

    payload = {
        "disease_name": "disease_a",
        "focus_area": "diagnosis",
        "document_source": "journal",
        "filename": "doc.pdf",
    }
    response = client.post("/api/rag/commit-to-vectordb", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "committed" in data.get("message", "").lower()


def test_re_embed(monkeypatch):
    mock_vsm = MagicMock()
    mock_vsm.re_embed_all.return_value = {
        "collections_processed": 2,
        "total_chunks_re_embedded": 50,
        "new_model": "text-embedding-3-small",
        "new_dimension": 1536,
    }
    _setup_rag_mocks(monkeypatch, mock_vsm)

    response = client.post("/api/rag/re-embed")
    assert response.status_code == 200
    data = response.json()
    assert "collections_processed" in data
    assert data["total_chunks_re_embedded"] == 50


def test_get_rag_suggestions(monkeypatch):
    mock_vsm = MagicMock()
    _setup_rag_mocks(monkeypatch, mock_vsm)

    async def fake_suggestions():
        return ["Suggestion 1", "Suggestion 2"]

    monkeypatch.setattr("server.api.rag.generate_specialty_suggestions", fake_suggestions)

    response = client.get("/api/rag/suggestions")
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)
    assert "Suggestion 1" in data["suggestions"]


def test_clear_database(monkeypatch):
    mock_vsm = MagicMock()
    mock_vsm.reset_database.return_value = True
    _setup_rag_mocks(monkeypatch, mock_vsm)

    response = client.post("/api/rag/clear-database")
    assert response.status_code == 200
    data = response.json()
    assert "cleared successfully" in data.get("message", "").lower()
