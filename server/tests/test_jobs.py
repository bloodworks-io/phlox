"""
Tests for the Wrap Up job-extraction endpoint (POST /api/note/extract-jobs).
"""

from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.patient import router as patient_router
from server.schemas.grammars import JobExtractionResult, ProposedJob

app = FastAPI()
app.include_router(patient_router, prefix="/api/note")
client = TestClient(app)


def test_extract_jobs_empty_plan():
    """An empty plan short-circuits to an explicit empty fallback."""
    response = client.post("/api/note/extract-jobs", json={"plan": "   "})
    assert response.status_code == 200
    assert response.json() == {
        "action_items": [],
        "excluded": [],
        "fallback": "empty",
    }


def test_extract_jobs_success(monkeypatch):
    """A successful model extraction is shaped into action_items/excluded."""
    result = JobExtractionResult(
        action_items=[ProposedJob(text="Book PET scan", category="action")],
        excluded=[ProposedJob(text="Review in 4 weeks", category="follow_up")],
    )
    monkeypatch.setattr(
        "server.api.patient.extract_jobs_from_plan",
        AsyncMock(return_value=result),
    )

    response = client.post(
        "/api/note/extract-jobs",
        json={"plan": "1. Book PET scan\n2. Review in 4 weeks"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["fallback"] is None
    assert [a["text"] for a in data["action_items"]] == ["Book PET scan"]
    assert data["action_items"][0]["category"] == "action"
    assert [e["text"] for e in data["excluded"]] == ["Review in 4 weeks"]
    assert data["excluded"][0]["category"] == "follow_up"


def test_extract_jobs_heuristic_fallback(monkeypatch):
    """When the model returns nothing usable, fall back to the dumb splitter."""
    monkeypatch.setattr(
        "server.api.patient.extract_jobs_from_plan",
        AsyncMock(return_value=JobExtractionResult(action_items=[], excluded=[])),
    )

    response = client.post(
        "/api/note/extract-jobs",
        json={"plan": "1. Book PET scan\n2. Refer dermatology"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["fallback"] == "heuristic"
    assert data["excluded"] == []
    assert len(data["action_items"]) == 2
    assert all(a["category"] == "action" for a in data["action_items"])
