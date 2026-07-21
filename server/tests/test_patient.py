"""
Tests for patient endpoints.
Assumes your patient-related endpoints are included from server/api/patient.py.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.patient import router as patient_router

# Create a minimal FastAPI app with the patient router.
app = FastAPI()
app.include_router(patient_router, prefix="/api/note")
client = TestClient(app)


def test_get_patients():
    # Assumes that GET /api/patients?date=2023-06-15 returns a list (possibly empty)
    response = client.get("/api/note/list?date=2023-06-15")
    assert response.status_code == 200
    data = response.json()
    # Data should be a list
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_patient_not_found(monkeypatch):
    """Test GET /api/patient/{id} with non-existent ID"""

    def fake_get_patient_by_id(*_args):
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Patient not found")

    # Also need to import HTTPException in server/api/patient.py
    monkeypatch.setattr(
        "server.database.entities.patient.get_patient_by_id",
        fake_get_patient_by_id,
    )
    response = client.get("/api/note/id/999999")
    assert response.status_code == 404


def test_search_patient():
    # Query search-patient endpoint with a dummy UR number
    response = client.get("/api/note/search?ur_number=NON_EXISTENT")
    assert response.status_code == 200
    data = response.json()
    # Expect data to be a list
    assert isinstance(data, list)


# For save and update endpoints, we patch the database functions.
@pytest.mark.asyncio
async def test_save_patient(monkeypatch):
    # Mock summarize_encounter to avoid actual LLM calls
    async def mock_summarize_encounter(*_args, **_kwargs):
        return "Test summary", "Test condition"

    monkeypatch.setattr("server.api.patient.summarise_encounter", mock_summarize_encounter)

    # Mock summarization_manager to avoid token generation issues
    mock_manager = MagicMock()
    mock_manager.generate_token.return_value = "test-token"
    mock_manager.should_process = AsyncMock(return_value=False)
    mock_manager.mark_complete = AsyncMock()
    monkeypatch.setattr("server.api.patient.summarization_manager", mock_manager)

    payload = {
        "patientData": {
            "name": "Doe, Jane",
            "dob": "1980-01-01",
            "ur_number": "URTEST001",
            "gender": "F",
            "encounter_date": "2023-06-15",
            "template_key": "test",
            "template_data": {},
            "raw_transcription": "",
            "transcription_duration": 0,
            "process_duration": 0,
            "primary_condition": "",
            "final_letter": "",
            "encounter_summary": "",
        }
    }

    def fake_save_patient(*_args):
        return 123

    monkeypatch.setattr("server.api.patient.save_patient", fake_save_patient)

    response = client.post("/api/note/save", json=payload)
    assert response.status_code == 200


def test_delete_patient(monkeypatch):
    # Patch delete_patient_by_id to simulate a successful deletion

    def fake_delete_patient_by_id(_pid: int):
        return True

    monkeypatch.setattr("server.api.patient.delete_patient_by_id", fake_delete_patient_by_id)
    response = client.delete("/api/note/id/123")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "deleted" in data["message"].lower()


def test_get_consent(monkeypatch):
    monkeypatch.setattr(
        "server.api.patient.get_scribe_consent",
        lambda _ur: {
            "scribe_consent_at": "2026-01-01T00:00:00",
            "scribe_consent_declined_at": None,
        },
    )
    response = client.get("/api/note/consent?ur_number=UR123")
    assert response.status_code == 200
    data = response.json()
    assert data["scribe_consent_at"] == "2026-01-01T00:00:00"
    assert data["scribe_consent_declined_at"] is None


def test_get_consent_no_profile_returns_nulls(monkeypatch):
    # A ur_number with no profile row should yield nulls, not an error.
    monkeypatch.setattr("server.api.patient.get_scribe_consent", lambda _ur: None)
    response = client.get("/api/note/consent?ur_number=UR999")
    assert response.status_code == 200
    assert response.json() == {
        "scribe_consent_at": None,
        "scribe_consent_declined_at": None,
    }


def test_set_consent(monkeypatch):
    captured = {}

    def fake_set(ur, consented):
        captured["ur"] = ur
        captured["consented"] = consented
        return {
            "scribe_consent_at": "2026-01-01T00:00:00" if consented else None,
            "scribe_consent_declined_at": None if consented else "2026-01-01T00:00:00",
        }

    monkeypatch.setattr("server.api.patient.set_scribe_consent", fake_set)
    response = client.post("/api/note/consent", json={"ur_number": "UR123", "consented": True})
    assert response.status_code == 200
    assert captured == {"ur": "UR123", "consented": True}
    assert response.json()["scribe_consent_at"] is not None
    assert response.json()["scribe_consent_declined_at"] is None


def test_scribe_consent_roundtrip_and_clearing_db():
    from server.database.entities.patient import get_scribe_consent, set_scribe_consent

    ur = "URCONSENT_RT"
    # Grant consent
    result = set_scribe_consent(ur, True)
    assert result is not None
    assert result["scribe_consent_at"] is not None
    assert result["scribe_consent_declined_at"] is None
    fetched = get_scribe_consent(ur)
    assert fetched is not None
    assert fetched["scribe_consent_at"] is not None
    assert fetched["scribe_consent_declined_at"] is None

    # Declining clears consent and records the refusal
    result = set_scribe_consent(ur, False)
    assert result is not None
    assert result["scribe_consent_at"] is None
    assert result["scribe_consent_declined_at"] is not None

    # Re-consenting clears the refusal and records consent again
    result = set_scribe_consent(ur, True)
    assert result is not None
    assert result["scribe_consent_at"] is not None
    assert result["scribe_consent_declined_at"] is None


def test_scribe_consent_targeted_upsert_preserves_demographics_db():
    from server.database.entities.patient import (
        get_patient_profile,
        get_scribe_consent,
        set_scribe_consent,
        upsert_patient_profile,
    )

    ur = "URCONSENT_DEMO"
    upsert_patient_profile(ur, "Jane", "Doe", "1980-01-01", "F", "123 St", "555-1234")
    set_scribe_consent(ur, True)

    # Demographics must survive the targeted consent upsert.
    profile = get_patient_profile(ur)
    assert profile is not None
    assert profile["first_name"] == "Jane"
    assert profile["last_name"] == "Doe"
    assert profile["dob"] == "1980-01-01"
    consent = get_scribe_consent(ur)
    assert consent is not None
    assert consent["scribe_consent_at"] is not None
