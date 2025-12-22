"""
Tests for patient endpoints.
Assumes your patient-related endpoints are included from server/api/patient.py.
"""

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.patient import router as patient_router

# Create a minimal FastAPI app with the patient router.
app = FastAPI()
app.include_router(patient_router, prefix="/api/patient")
client = TestClient(app)

def test_get_patients():
    # Assumes that GET /api/patients?date=2023-06-15 returns a list (possibly empty)
    response = client.get("/api/patient/list?date=2023-06-15")
    assert response.status_code == 200
    data = response.json()
    # Data should be a list
    assert isinstance(data, list)

@pytest.mark.asyncio
async def test_get_patient_not_found(monkeypatch):
    """Test GET /api/patient/{id} with non-existent ID"""
    def fake_get_patient_by_id(*args):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Patient not found")

    # Also need to import HTTPException in server/api/patient.py
    monkeypatch.setattr("server.database.patient.get_patient_by_id", fake_get_patient_by_id)
    response = client.get("/api/patient/id/999999")
    assert response.status_code == 404

def test_search_patient():
    # Query search-patient endpoint with a dummy UR number
    response = client.get("/api/patient/search?ur_number=NON_EXISTENT")
    assert response.status_code == 200
    data = response.json()
    # Expect data to be a list
    assert isinstance(data, list)

@pytest.fixture
def mock_summarize(monkeypatch):
    async def fake_summarize(*args, **kwargs):
        return "Test summary", "Test condition"
    monkeypatch.setattr("server.utils.llm.summarisation.summarise_encounter", fake_summarize)
    return fake_summarize

# For save and update endpoints, we patch the database functions.
@pytest.mark.asyncio
async def test_save_patient(monkeypatch):
    # Mock summarize_encounter to avoid actual LLM calls
    async def mock_summarize_encounter(*args, **kwargs):
        return "Test summary", "Test condition"
    monkeypatch.setattr("server.api.patient.summarize_encounter", mock_summarize_encounter)

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
            "encounter_summary": ""
        }
    }

    def fake_save_patient(*args):
        return 123
    monkeypatch.setattr("server.api.patient.save_patient", fake_save_patient)

    response = client.post("/api/patient/save", json=payload)
    assert response.status_code == 200

def test_delete_patient(monkeypatch):
    # Patch delete_patient_by_id to simulate a successful deletion
    from server.database.patient import delete_patient_by_id

    def fake_delete_patient_by_id(pid: int):
        return True

    monkeypatch.setattr("server.api.patient.delete_patient_by_id", fake_delete_patient_by_id)
    response = client.delete("/api/patient/id/123")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "deleted" in data["message"].lower()
