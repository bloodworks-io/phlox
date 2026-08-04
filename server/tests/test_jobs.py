"""
Tests for the Wrap Up job-extraction endpoint (POST /api/note/extract-jobs).
Also repo-level tests for jobs.get_latest_encounter_with_jobs and
jobs._select_jobs_list_with_cursor.
"""

import json
import os
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.patient import router as patient_router
from server.database.core.connection import PatientDatabase
from server.database.repositories import jobs
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


# --------------------------------------------------------------------------- #
# Repo-level tests for jobs.get_latest_encounter_with_jobs / _select_jobs_list_with_cursor
# --------------------------------------------------------------------------- #


@pytest.fixture(scope="module")
def repo_db(tmp_path_factory):
    temp_dir = tmp_path_factory.mktemp("data")
    os.environ["DB_ENCRYPTION_KEY"] = "test_key"
    os.environ["TESTING"] = "true"
    db = PatientDatabase(db_dir=str(temp_dir))
    yield db
    db.clear_test_database()
    db.close()


def _seed_encounter_with_jobs(db, ur_number, first, last, jobs_list_json):
    with db.transaction() as cursor:
        cursor.execute(
            "INSERT INTO patient_profiles (ur_number, first_name, last_name) VALUES (?, ?, ?)",
            (ur_number, first, last),
        )
        cursor.execute(
            "INSERT INTO encounters (ur_number, encounter_date, jobs_list) VALUES (?, ?, ?)",
            (ur_number, "2024-06-01", jobs_list_json),
        )
        return cursor.lastrowid


def test_get_latest_encounter_with_jobs_by_ur(repo_db, monkeypatch):
    repo_db.clear_test_database()
    monkeypatch.setattr(jobs, "get_db", lambda: repo_db)
    payload = json.dumps([{"id": 1, "job": "book scan", "completed": False}])
    _seed_encounter_with_jobs(repo_db, "UR1", "John", "Smith", payload)

    row = jobs.get_latest_encounter_with_jobs(ur_number="UR1")
    assert row is not None
    assert row["ur_number"] == "UR1"
    assert row["jobs_list"] == payload
    assert row["first_name"] == "John"


def test_get_latest_encounter_with_jobs_by_name(repo_db, monkeypatch):
    repo_db.clear_test_database()
    monkeypatch.setattr(jobs, "get_db", lambda: repo_db)
    _seed_encounter_with_jobs(repo_db, "UR1", "John", "Smith", "[]")

    row = jobs.get_latest_encounter_with_jobs(patient_name="smith")
    assert row is not None
    assert row["ur_number"] == "UR1"


def test_get_latest_encounter_with_jobs_none_when_no_args(repo_db):
    repo_db.clear_test_database()
    assert jobs.get_latest_encounter_with_jobs() is None


def test_select_jobs_list_with_cursor_returns_row(repo_db):
    """The cursor-sharing helper reads on the caller's transaction cursor
    (used by complete_job's read-modify-write)."""
    repo_db.clear_test_database()
    with repo_db.transaction() as cursor:
        cursor.execute(
            "INSERT INTO patient_profiles (ur_number, first_name, last_name) VALUES (?, ?, ?)",
            ("UR1", "John", "Smith"),
        )
        cursor.execute(
            "INSERT INTO encounters (ur_number, encounter_date, jobs_list) VALUES (?, ?, ?)",
            ("UR1", "2024-06-01", "[]"),
        )
        note_id = cursor.lastrowid

        row = jobs._select_jobs_list_with_cursor(cursor, note_id)

    assert row is not None
    assert row["id"] == note_id
    assert row["ur_number"] == "UR1"
    assert row["first_name"] == "John"
    assert row["jobs_list"] == "[]"


def test_select_jobs_list_with_cursor_none_when_missing(repo_db):
    repo_db.clear_test_database()
    with repo_db.transaction() as cursor:
        assert jobs._select_jobs_list_with_cursor(cursor, 999999) is None
