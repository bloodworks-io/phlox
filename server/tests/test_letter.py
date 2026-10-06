"""
Tests for letter endpoints.
We patch generation and saving functions.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.letter import router as letter_router

app = FastAPI()
app.include_router(letter_router, prefix="/api/letter")
client = TestClient(app)


def test_generate_letter(monkeypatch):
    # generate_letter_content is async, so the mock must be async too
    async def fake_generate_letter_content(*_args, **_kwargs):
        return {"letter": "This is a generated letter.", "context": []}

    monkeypatch.setattr("server.api.letter.generate_letter_content", fake_generate_letter_content)
    payload = {
        "patientName": "Smith, John",
        "gender": "M",
        "dob": "1990-01-01",
        "template_data": {"key": "value"},
        "additional_instruction": "Please include urgent follow-up.",
        "context": [],
    }
    response = client.post("/api/letter/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "letter" in data
    assert "context" in data
    assert "generated letter" in data["letter"]


def test_save_letter(monkeypatch):
    def fake_update_patient_letter(_noteId, _letter):
        return True

    monkeypatch.setattr("server.api.letter.update_patient_letter", fake_update_patient_letter)
    payload = {"noteId": 123, "letter": "This is a saved letter."}
    response = client.post("/api/letter/save", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "saved" in data["message"].lower()


def test_save_letter_persists():
    """End-to-end save against the test database."""
    from server.database.core.connection import get_db

    with get_db().transaction() as cursor:
        cursor.execute(
            "INSERT INTO encounters (ur_number, encounter_date) VALUES (?, ?)",
            ("URLETTER1", "2024-01-01"),
        )
        note_id = cursor.lastrowid

    response = client.post("/api/letter/save", json={"noteId": note_id, "letter": "Real letter."})
    assert response.status_code == 200

    with get_db().read() as cursor:
        cursor.execute("SELECT final_letter FROM encounters WHERE id = ?", (note_id,))
        assert cursor.fetchone()["final_letter"] == "Real letter."


def test_save_letter_not_found():
    """Saving against a nonexistent note must 404, not silently succeed."""
    response = client.post(
        "/api/letter/save", json={"noteId": 999999999, "letter": "Orphan letter."}
    )
    assert response.status_code == 404


def test_note_save_does_not_clobber_letter():
    """A note save must not overwrite a saved letter with a stale final_letter."""
    from server.database.core.connection import get_db
    from server.database.repositories.encounter import update_patient
    from server.database.repositories.letter import update_patient_letter
    from server.schemas.patient import Patient

    with get_db().transaction() as cursor:
        cursor.execute(
            "INSERT INTO encounters (ur_number, encounter_date) VALUES (?, ?)",
            ("URLETTER2", "2024-01-02"),
        )
        note_id = cursor.lastrowid

    assert update_patient_letter(note_id, "legit letter") is True

    update_patient(
        Patient(
            id=note_id,
            name="Smith, John",
            ur_number="URLETTER2",
            encounter_date="2024-01-02",
            final_letter="STALE COPY",
        )
    )

    with get_db().read() as cursor:
        cursor.execute("SELECT final_letter FROM encounters WHERE id = ?", (note_id,))
        assert cursor.fetchone()["final_letter"] == "legit letter"


def test_fetch_letter(monkeypatch):
    def fake_fetch_patient_letter(_noteId):
        return "Fetched letter content."

    monkeypatch.setattr("server.api.letter.fetch_patient_letter", fake_fetch_patient_letter)
    response = client.get("/api/letter/fetch-letter?noteId=123")
    assert response.status_code == 200
    data = response.json()
    assert "letter" in data
    assert "Fetched letter content" in data["letter"]


def test_fetch_letter_none_when_absent(monkeypatch):
    """No letter attached must be JSON null, not a placeholder string."""

    def fake_fetch_patient_letter(_noteId):
        return None

    monkeypatch.setattr("server.api.letter.fetch_patient_letter", fake_fetch_patient_letter)
    response = client.get("/api/letter/fetch-letter?noteId=123")
    assert response.status_code == 200
    assert response.json()["letter"] is None


def test_get_templates(monkeypatch):
    # get_letter_templates() takes no arguments (it queries all templates)
    def fake_get_letter_templates():
        return [{"id": 1, "name": "Test Template", "instructions": "Do this"}]

    monkeypatch.setattr("server.api.letter.get_letter_templates", fake_get_letter_templates)
    response = client.get("/api/letter/templates")
    assert response.status_code == 200
    data = response.json()
    assert "templates" in data
    assert isinstance(data["templates"], list)
    assert "default_template_id" in data


def test_create_template(monkeypatch):
    def fake_save_letter_template(_template):
        return 42

    monkeypatch.setattr("server.api.letter.save_letter_template", fake_save_letter_template)
    payload = {"id": None, "name": "New Template", "instructions": "Test instructions"}
    response = client.post("/api/letter/templates", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data.get("id") == 42


def test_update_template(monkeypatch):
    monkeypatch.setattr("server.api.letter.update_letter_template", lambda _id, _template: True)
    payload = {"id": None, "name": "Updated Template", "instructions": "Updated instructions"}
    response = client.put("/api/letter/templates/1", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "updated" in data.get("message", "").lower()


def test_delete_template(monkeypatch):
    monkeypatch.setattr("server.api.letter.delete_letter_template", lambda _id: True)
    response = client.delete("/api/letter/templates/1")
    assert response.status_code == 200
    data = response.json()
    assert "deleted" in data.get("message", "").lower()


@pytest.mark.usefixtures("clinician_ctx")
def test_template_reset_requires_admin():
    """Resetting letter templates wipes every user's templates: admin only."""
    from fastapi import HTTPException

    from server.api.letter import reset_templates

    with pytest.raises(HTTPException) as exc:
        reset_templates()
    assert exc.value.status_code == 403
