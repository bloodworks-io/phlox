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


def _protected_template_payload(key):
    return [
        {
            "template_key": key,
            "template_name": "Poisoned",
            "fields": [
                {
                    "field_key": "field",
                    "field_name": "Field",
                    "field_type": "text",
                    "persistent": False,
                    "system_prompt": "PWNED PROMPT",
                    "initial_prompt": "",
                    "style_example": "",
                }
            ],
        }
    ]


def test_save_templates_forks_protected_on_create(monkeypatch):
    """Saving a protected template creates custom_phlox_1; default pointer follows."""
    from server.database.config.manager import config_manager

    saved = {}

    def fake_save_template(template):
        saved["key"] = template.template_key

    monkeypatch.setattr("server.api.templates.template_exists", lambda _key: False)
    monkeypatch.setattr("server.api.templates.save_template", fake_save_template)

    original_default = config_manager.get_default_template_key() or "phlox_01"
    try:
        config_manager.set_default_template_key("phlox_01")
        response = client.post("/api/templates", json=_protected_template_payload("phlox_01"))
        assert response.status_code == 200
        data = response.json()
        assert saved["key"] == "custom_phlox_1"
        assert data["updated_keys"]["phlox_01"] == "custom_phlox_1"
        assert any("Forked default template" in d for d in data["details"])
        assert config_manager.get_default_template_key() == "custom_phlox_1"
    finally:
        config_manager.set_default_template_key(original_default)


def test_save_templates_fork_does_not_move_unrelated_default(monkeypatch):
    """Forking a non-default protected template leaves the default pointer alone."""
    from server.database.config.manager import config_manager

    monkeypatch.setattr("server.api.templates.template_exists", lambda _key: False)
    monkeypatch.setattr("server.api.templates.save_template", lambda _t: None)

    original_default = config_manager.get_default_template_key() or "phlox_01"
    try:
        config_manager.set_default_template_key("phlox_01")
        response = client.post("/api/templates", json=_protected_template_payload("consult_01"))
        assert response.status_code == 200
        assert response.json()["updated_keys"]["consult_01"] == "custom_consult_1"
        assert config_manager.get_default_template_key() == "phlox_01"
    finally:
        config_manager.set_default_template_key(original_default)


def test_save_templates_fork_update_bumps_lineage(monkeypatch):
    """Changed re-save of an existing fork version-bumps the fork, not the original."""
    monkeypatch.setattr("server.api.templates.template_exists", lambda key: key == "custom_phlox_1")
    monkeypatch.setattr("server.api.templates.update_template", lambda _t: "custom_phlox_2")

    response = client.post("/api/templates", json=_protected_template_payload("phlox_01"))
    assert response.status_code == 200
    data = response.json()
    assert data["updated_keys"]["phlox_01"] == "custom_phlox_2"
    assert any("Updated template" in d for d in data["details"])


def test_save_templates_fork_of_legacy_version_sibling(monkeypatch):
    """Editing a legacy user version (phlox_05) forks to custom_phlox_1 with content carried."""
    from server.database.config.manager import config_manager

    saved = {}

    def fake_save_template(template):
        saved["key"] = template.template_key
        saved["fields"] = template.fields

    monkeypatch.setattr("server.api.templates.template_exists", lambda _key: False)
    monkeypatch.setattr("server.api.templates.save_template", fake_save_template)

    original_default = config_manager.get_default_template_key() or "phlox_01"
    try:
        config_manager.set_default_template_key("phlox_05")
        payload = _protected_template_payload("phlox_05")
        response = client.post("/api/templates", json=payload)
        assert response.status_code == 200
        assert saved["key"] == "custom_phlox_1"  # base-stripped, not custom_phlox_05_1
        assert response.json()["updated_keys"]["phlox_05"] == "custom_phlox_1"
        assert config_manager.get_default_template_key() == "custom_phlox_1"
    finally:
        config_manager.set_default_template_key(original_default)


def test_fork_shadows_original_in_get_all():
    """A live custom_ fork hides its protected original; deleting it un-shadows."""
    import json as jsonlib
    from datetime import datetime

    from server.database.core.connection import get_db
    from server.database.repositories import templates as repo

    now = datetime.now().isoformat()
    fields = jsonlib.dumps(
        [
            {
                "field_key": "f",
                "field_name": "F",
                "field_type": "text",
                "persistent": False,
                "system_prompt": "x",
                "style_example": "y",
            }
        ]
    )

    def _insert(cur, key):
        cur.execute(
            "INSERT OR REPLACE INTO clinical_templates "
            "(template_key, template_name, fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (key, key, fields, now, now),
        )

    try:
        with get_db().transaction() as cur:
            _insert(cur, "soap_01")  # ensure present even if seeding changed
            _insert(cur, "custom_soap_1")

        keys = [t["template_key"] for t in repo.get_all_templates()]
        assert "custom_soap_1" in keys
        assert "soap_01" not in keys  # shadowed

        # Soft-deleting the fork un-shadows the original
        with get_db().transaction() as cur:
            cur.execute(
                "UPDATE clinical_templates SET deleted = TRUE WHERE template_key = 'custom_soap_1'"
            )
        keys = [t["template_key"] for t in repo.get_all_templates()]
        assert "soap_01" in keys
        assert "custom_soap_1" not in keys
    finally:
        with get_db().transaction() as cur:
            cur.execute("DELETE FROM clinical_templates WHERE template_key IN ('custom_soap_1')")
            cur.execute(
                "UPDATE clinical_templates SET deleted = FALSE WHERE template_key = 'soap_01'"
            )


def test_unrelated_custom_prefix_does_not_shadow():
    """custom_phlox_review_1 is not a phlox fork and must not hide phlox_01."""
    import json as jsonlib
    from datetime import datetime

    from server.database.core.connection import get_db
    from server.database.repositories import templates as repo

    now = datetime.now().isoformat()
    fields = jsonlib.dumps([])
    try:
        with get_db().transaction() as cur:
            cur.execute(
                "INSERT OR REPLACE INTO clinical_templates "
                "(template_key, template_name, fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                ("custom_phlox_review_1", "Custom Phlox Review", fields, now, now),
            )
        keys = [t["template_key"] for t in repo.get_all_templates()]
        assert "phlox_01" in keys  # not shadowed by the unrelated name
    finally:
        with get_db().transaction() as cur:
            cur.execute(
                "DELETE FROM clinical_templates WHERE template_key = 'custom_phlox_review_1'"
            )


def test_adaptive_instructions_reject_protected_template():
    """Adaptive-instruction writes (prompt-injection channel) must 403 for protected keys."""
    response = client.post("/api/templates/phlox_01/fields/field/adaptive-instructions/reset")
    assert response.status_code == 403
    response = client.post("/api/templates/soap_01/fields/field/adaptive-instructions/consolidate")
    assert response.status_code == 403


def test_generate_unique_template_key_never_protected(monkeypatch):
    """LLM-suggested names must not yield protected keys (version-poison chain)."""
    from server.nlp_tools.templates import generate_unique_template_key

    monkeypatch.setattr("server.nlp_tools.templates.template_exists", lambda _k, **_kw: False)
    assert generate_unique_template_key("Phlox") == "custom_phlox_1"
    assert generate_unique_template_key("SOAP Note") == "custom_soap_note_1"
    assert generate_unique_template_key("Progress Review") == "custom_progress_review_1"
    assert generate_unique_template_key("Cardiology") == "cardiology_1"


def test_default_templates_are_protected():
    """Drift guard: every seeded default's base prefix must be protected."""
    from server.constants import PROTECTED_TEMPLATE_PREFIXES
    from server.database.config.defaults.templates import DefaultTemplates

    keys = [t["template_key"] for t in DefaultTemplates.get_default_templates()]
    assert keys, "no default templates found"
    for key in keys:
        assert key.startswith(PROTECTED_TEMPLATE_PREFIXES), (
            f"Seeded default '{key}' has no protected prefix; add its base to "
            "PROTECTED_TEMPLATE_PREFIXES in server/constants.py"
        )


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


def _seed_fork_row(key):
    import json as jsonlib
    from datetime import datetime

    from server.database.core.connection import get_db

    now = datetime.now().isoformat()
    with get_db().transaction() as cur:
        cur.execute(
            "INSERT OR REPLACE INTO clinical_templates "
            "(template_key, template_name, fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (key, key, jsonlib.dumps([]), now, now),
        )


def test_reset_fork_repoints_active_default():
    """DELETE on a fork holding the active default restores the seeded original."""
    from server.database.config.manager import config_manager
    from server.database.core.connection import get_db
    from server.database.repositories import templates as repo

    _seed_fork_row("custom_phlox_1")
    original = config_manager.get_default_template_key() or "phlox_01"
    try:
        config_manager.set_default_template_key("custom_phlox_1")
        response = client.delete("/api/templates/custom_phlox_1")
        assert response.status_code == 200

        assert config_manager.get_default_template_key() == "phlox_01"
        with get_db().read() as cur:
            cur.execute(
                "SELECT deleted FROM clinical_templates WHERE template_key = 'custom_phlox_1'"
            )
            assert cur.fetchone()["deleted"] == 1  # soft-deleted, history intact
        keys = [t["template_key"] for t in repo.get_all_templates()]
        assert "phlox_01" in keys  # un-shadowed
        assert "custom_phlox_1" not in keys
    finally:
        config_manager.set_default_template_key(original)
        with get_db().transaction() as cur:
            cur.execute("DELETE FROM clinical_templates WHERE template_key = 'custom_phlox_1'")
            cur.execute(
                "UPDATE clinical_templates SET deleted = FALSE WHERE template_key = 'phlox_01'"
            )


def test_reset_fork_not_default_leaves_pointer():
    """DELETE on a fork that isn't the active default leaves the default alone."""
    from server.database.config.manager import config_manager
    from server.database.core.connection import get_db

    _seed_fork_row("custom_consult_1")
    original = config_manager.get_default_template_key() or "phlox_01"
    try:
        config_manager.set_default_template_key("phlox_01")
        response = client.delete("/api/templates/custom_consult_1")
        assert response.status_code == 200
        assert config_manager.get_default_template_key() == "phlox_01"
        with get_db().read() as cur:
            cur.execute(
                "SELECT deleted FROM clinical_templates WHERE template_key = 'custom_consult_1'"
            )
            assert cur.fetchone()["deleted"] == 1
    finally:
        config_manager.set_default_template_key(original)
        with get_db().transaction() as cur:
            cur.execute("DELETE FROM clinical_templates WHERE template_key = 'custom_consult_1'")
            cur.execute(
                "UPDATE clinical_templates SET deleted = FALSE WHERE template_key = 'consult_01'"
            )


def test_delete_plain_custom_template_no_repoint():
    """Deleting an ordinary custom template never touches the default pointer."""
    from server.database.config.manager import config_manager
    from server.database.core.connection import get_db

    _seed_fork_row("cardiology_1")
    original = config_manager.get_default_template_key() or "phlox_01"
    try:
        config_manager.set_default_template_key("phlox_01")
        response = client.delete("/api/templates/cardiology_1")
        assert response.status_code == 200
        assert config_manager.get_default_template_key() == "phlox_01"
    finally:
        config_manager.set_default_template_key(original)
        with get_db().transaction() as cur:
            cur.execute("DELETE FROM clinical_templates WHERE template_key = 'cardiology_1'")
