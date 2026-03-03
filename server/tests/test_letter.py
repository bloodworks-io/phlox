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
    # Patch generate_letter_content to return a dummy letter
    def fake_generate_letter_content(*args, **kwargs):
        return "This is a generated letter."

    monkeypatch.setattr("server.api.letter.generate_letter_content", fake_generate_letter_content)
    payload = {
        "patientName": "Smith, John",
        "gender": "M",
        "template_data": {"key": "value"},
        "additional_instruction": "Please include urgent follow-up.",
        "context": [],
    }
    response = client.post("/api/letter/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "letter" in data
    assert "generated letter" in data["letter"]


@pytest.mark.asyncio  # Add this decorator
async def test_generate_letter(monkeypatch):
    # Make fake_generate_letter_content async
    async def fake_generate_letter_content(*args, **kwargs):
        return "This is a generated letter."

    monkeypatch.setattr("server.api.letter.generate_letter_content", fake_generate_letter_content)
    payload = {"patientId": 123, "letter": "This is a saved letter."}
    response = client.post("/api/letter/save", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "saved" in data["message"].lower()


def test_fetch_letter(monkeypatch):
    async def fake_fetch_patient_letter(patientId):
        return "Fetched letter content."

    monkeypatch.setattr("server.api.letter.fetch_patient_letter", fake_fetch_patient_letter)
    response = client.get("/api/letter/fetch-letter?patientId=123")
    assert response.status_code == 200
    data = response.json()
    assert "letter" in data
    assert "Fetched letter content" in data["letter"]


def test_get_templates(monkeypatch):
    # Patch get_letter_templates to return a dummy list
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
    # Patch save_letter_template
    def fake_save_letter_template(template):
        return 42

    monkeypatch.setattr("server.api.letter.save_letter_template", fake_save_letter_template)
    payload = {"id": None, "name": "New Template", "instructions": "Test instructions"}
    response = client.post("/api/letter/templates", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data.get("id") == 42


def test_update_template(monkeypatch):
    # Patch update_letter_template to return success
    monkeypatch.setattr("server.api.letter.update_letter_template", lambda id, template: True)
    payload = {"id": None, "name": "Updated Template", "instructions": "Updated instructions"}
    response = client.put("/api/letter/templates/1", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "updated" in data.get("message", "").lower()


def test_delete_template(monkeypatch):
    # Patch delete_letter_template to simulate successful deletion
    monkeypatch.setattr("server.api.letter.delete_letter_template", lambda id: True)
    response = client.delete("/api/letter/templates/1")
    assert response.status_code == 200
    data = response.json()
    assert "deleted" in data.get("message", "").lower()
