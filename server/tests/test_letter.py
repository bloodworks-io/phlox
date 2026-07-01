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


@pytest.mark.asyncio
async def test_save_letter(monkeypatch):
    async def fake_generate_letter_content(*_args, **_kwargs):
        return {"letter": "This is a generated letter.", "context": []}

    monkeypatch.setattr("server.api.letter.generate_letter_content", fake_generate_letter_content)
    payload = {"noteId": 123, "letter": "This is a saved letter."}
    response = client.post("/api/letter/save", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "saved" in data["message"].lower()


def test_fetch_letter(monkeypatch):
    async def fake_fetch_patient_letter(_noteId):
        return "Fetched letter content."

    monkeypatch.setattr("server.api.letter.fetch_patient_letter", fake_fetch_patient_letter)
    response = client.get("/api/letter/fetch-letter?noteId=123")
    assert response.status_code == 200
    data = response.json()
    assert "letter" in data
    assert "Fetched letter content" in data["letter"]


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
