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
    def fake_set_default_template(_template_key: str):
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
    def fake_template_exists(_key: str):
        return False

    def fake_save_template(_template):
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
                    "style_example": "- Example bullet point",
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
    async def fake_generate_template_from_note(_note: str):
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
                    style_example="- Example item",
                )
            ],
        )

    monkeypatch.setattr(
        "server.api.templates.generate_template_from_note", fake_generate_template_from_note
    )
    monkeypatch.setattr("server.api.templates.save_template", lambda _template: "test_generated_01")
    payload = {"exampleNote": "This is an example note."}
    response = client.post("/api/templates/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data.get("template_key") == "test_generated_01"


def test_default_template_key_round_trip_via_config_manager():
    """get/set default_template_key flow through ConfigManager (the chokepoint)."""
    from server.database.config.manager import config_manager

    original = config_manager.get_default_template_key()
    try:
        config_manager.set_default_template_key("roundtrip_01")
        assert config_manager.get_default_template_key() == "roundtrip_01"
    finally:
        if original is not None:
            config_manager.set_default_template_key(original)


def test_update_default_template_key_version_bump():
    """The version-bump path moves the pointer only when the old key matches."""
    from server.database.config.manager import config_manager

    original = config_manager.get_default_template_key()
    try:
        config_manager.set_default_template_key("vertest_01")
        config_manager.update_default_template_key("vertest_01", "vertest_02")
        assert config_manager.get_default_template_key() == "vertest_02"
        # A non-matching old key must NOT move the pointer.
        config_manager.update_default_template_key("does_not_exist", "vertest_03")
        assert config_manager.get_default_template_key() == "vertest_02"
    finally:
        if original is not None:
            config_manager.set_default_template_key(original)


def test_templates_repo_no_longer_references_user_settings():
    """C2 guarantee: templates.py must not touch the user_settings table directly."""
    from pathlib import Path

    import server.database.repositories.templates as templates_module

    source = Path(templates_module.__file__).read_text()
    assert "user_settings" not in source, (
        "templates.py must route default_template_key access through ConfigManager, "
        "not touch user_settings directly."
    )
