"""
Tests for template endpoints.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.templates import router as templates_router

app = FastAPI()
app.include_router(templates_router, prefix="/api/templates")
client = TestClient(app)


def test_set_default_template(monkeypatch):
    # Patch set_default_template in database.config
    def fake_set_default_template(template_key: str):
        return

    monkeypatch.setattr("server.api.templates.set_default_template", fake_set_default_template)
    response = client.post("/api/templates/default/phlox_01")
    assert response.status_code == 200
    data = response.json()
    assert "Set phlox_01" in data.get("message", "")


def test_get_default_template(monkeypatch):
    # Patch get_default_template to return a dummy value
    def fake_get_default_template():
        return {"template_key": "phlox_01"}

    monkeypatch.setattr("server.api.templates.get_default_template", fake_get_default_template)
    response = client.get("/api/templates/default")
    assert response.status_code == 200
    data = response.json()
    assert data.get("template_key") == "phlox_01"


def test_get_template(monkeypatch):
    # Patch get_template_by_key
    def fake_get_template(template_key: str):
        return {"template_key": template_key, "template_name": "Test Template", "fields": []}

    monkeypatch.setattr("server.api.templates.get_template_by_key", fake_get_template)
    response = client.get("/api/templates/phlox_01")
    assert response.status_code == 200
    data = response.json()
    assert data.get("template_key") == "phlox_01"


def test_get_templates():
    # This test calls the endpoint and expects a list (empty or not)
    response = client.get("/api/templates")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_save_templates(monkeypatch):
    # Patch save_template and update_template
    def fake_template_exists(key: str):
        return False

    def fake_save_template(template):
        return

    monkeypatch.setattr("server.api.templates.template_exists", fake_template_exists)
    monkeypatch.setattr("server.api.templates.save_template", fake_save_template)

    templates_payload = [
        {
            "template_key": "test_template",
            "template_name": "Test Template",
            "fields": [
                {
                    "field_key": "test_field",
                    "field_name": "Test Field",
                    "field_type": "text",
                    "persistent": False,
                    "system_prompt": "System prompt",
                    "initial_prompt": "Initial prompt",
                }
            ],
        }
    ]

    response = client.post("/api/templates", json=templates_payload)
    assert response.status_code == 200
    data = response.json()
    assert "Templates processed successfully" in data.get("message", "")


def test_generate_template(monkeypatch):
    # Patch generate_template_from_note and save_template
    async def fake_generate_template_from_note(note: str):
        from server.schemas.templates import ClinicalTemplate, TemplateField

        return ClinicalTemplate(
            template_key="test_generated_01",
            template_name="Test Generated",
            fields=[
                TemplateField(
                    field_key="test_field",
                    field_name="Test Field",
                    field_type="text",
                    persistent=False,
                    system_prompt="Prompt",
                    initial_prompt="Initial",
                )
            ],
        )

    monkeypatch.setattr(
        "server.api.templates.generate_template_from_note", fake_generate_template_from_note
    )
    monkeypatch.setattr("server.api.templates.save_template", lambda template: "test_generated_01")
    payload = {"exampleNote": "This is an example note."}
    response = client.post("/api/templates/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data.get("template_key") == "test_generated_01"
