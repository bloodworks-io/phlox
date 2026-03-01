"""
Tests for RAG endpoints.
We patch ChromaManager methods to simulate vector database interactions.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.rag import router as rag_router

app = FastAPI()
app.include_router(rag_router, prefix="/api/rag")
client = TestClient(app)


def test_get_files(monkeypatch):
    # Patch chroma_manager.list_collections to return dummy collections
    dummy_collections = ["disease_a", "disease_b"]
    monkeypatch.setattr("server.api.rag.chroma_manager.list_collections", lambda: dummy_collections)
    response = client.get("/api/rag/files")
    assert response.status_code == 200
    data = response.json()
    assert "files" in data
    assert set(data["files"]) == set(dummy_collections)


def test_get_collection_files(monkeypatch):
    # Patch chroma_manager.get_files_for_collection
    monkeypatch.setattr(
        "server.api.rag.chroma_manager.get_files_for_collection", lambda name: ["file1", "file2"]
    )
    response = client.get("/api/rag/collection_files/test_collection")
    assert response.status_code == 200
    data = response.json()
    assert "files" in data
    assert isinstance(data["files"], list)


def test_modify_collection(monkeypatch):
    # Patch chroma_manager.modify_collection_name to return True
    monkeypatch.setattr(
        "server.api.rag.chroma_manager.modify_collection_name", lambda old, new: True
    )
    payload = {"old_name": "old_collection", "new_name": "new_collection"}
    response = client.post("/api/rag/modify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "renamed successfully" in data.get("message", "").lower()


def test_delete_collection(monkeypatch):
    # Patch chroma_manager.delete_collection
    monkeypatch.setattr("server.api.rag.chroma_manager.delete_collection", lambda name: True)
    response = client.delete("/api/rag/delete-collection/test_collection")
    assert response.status_code == 200
    data = response.json()
    assert "deleted successfully" in data.get("message", "").lower()


def test_commit_to_vectordb(monkeypatch):
    # We simply patch the commit_to_vectordb method to not raise.
    monkeypatch.setattr(
        "server.api.rag.chroma_manager.commit_to_vectordb",
        lambda disease, focus, source, fname: None,
    )
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
    # Patch generate_specialty_suggestions to return a dummy list
    monkeypatch.setattr(
        "server.api.rag.generate_specialty_suggestions", lambda: ["Suggestion 1", "Suggestion 2"]
    )
    response = client.get("/api/rag/suggestions")
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)
    assert "Suggestion 1" in data["suggestions"]


def test_clear_database(monkeypatch):
    # Patch clear_database in chroma_manager to simulate success.
    monkeypatch.setattr("server.api.rag.chroma_manager.delete_collection", lambda name: True)
    response = client.post("/api/rag/clear-database")
    assert response.status_code == 200
    data = response.json()
    assert "cleared successfully" in data.get("message", "").lower()
