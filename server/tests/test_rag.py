"""
Tests for RAG endpoints.
We mock get_chroma_manager and CHROMADB_AVAILABLE to simulate vector database interactions.
"""

from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.rag import router as rag_router

app = FastAPI()
app.include_router(rag_router, prefix="/api/rag")
client = TestClient(app)


def _setup_rag_mocks(monkeypatch, mock_cm: MagicMock):
    """Common setup: enable RAG availability and return a mock chroma manager."""
    monkeypatch.setattr("server.api.rag.CHROMADB_AVAILABLE", True)
    monkeypatch.setattr("server.api.rag.get_chroma_manager", lambda: mock_cm)


def test_get_files(monkeypatch):
    mock_cm = MagicMock()
    mock_cm.list_collections.return_value = ["disease_a", "disease_b"]
    _setup_rag_mocks(monkeypatch, mock_cm)

    response = client.get("/api/rag/files")
    assert response.status_code == 200
    data = response.json()
    assert "files" in data
    assert set(data["files"]) == {"disease_a", "disease_b"}


def test_get_collection_files(monkeypatch):
    mock_cm = MagicMock()
    mock_cm.get_files_for_collection.return_value = ["file1", "file2"]
    _setup_rag_mocks(monkeypatch, mock_cm)

    response = client.get("/api/rag/collection_files/test_collection")
    assert response.status_code == 200
    data = response.json()
    assert "files" in data
    assert isinstance(data["files"], list)


def test_modify_collection(monkeypatch):
    mock_cm = MagicMock()
    mock_cm.modify_collection_name.return_value = True
    _setup_rag_mocks(monkeypatch, mock_cm)

    payload = {"old_name": "old_collection", "new_name": "new_collection"}
    response = client.post("/api/rag/modify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "renamed successfully" in data.get("message", "").lower()


def test_delete_collection(monkeypatch):
    mock_cm = MagicMock()
    mock_cm.delete_collection.return_value = True
    _setup_rag_mocks(monkeypatch, mock_cm)

    response = client.delete("/api/rag/delete-collection/test_collection")
    assert response.status_code == 200
    data = response.json()
    assert "deleted successfully" in data.get("message", "").lower()


def test_commit_to_vectordb(monkeypatch):
    mock_cm = MagicMock()
    mock_cm.commit_to_vectordb.return_value = None
    _setup_rag_mocks(monkeypatch, mock_cm)

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


def test_get_rag_suggestions(monkeypatch):
    mock_cm = MagicMock()
    _setup_rag_mocks(monkeypatch, mock_cm)

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
    mock_cm = MagicMock()
    mock_cm.reset_database.return_value = True
    _setup_rag_mocks(monkeypatch, mock_cm)

    response = client.post("/api/rag/clear-database")
    assert response.status_code == 200
    data = response.json()
    assert "cleared successfully" in data.get("message", "").lower()
