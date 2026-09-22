"""Regression tests for template default/edit flows.

Covers the bugs where:
- a stale ``default_template_key`` echoed back via ``POST /api/config/user``
  silently reverted a freshly chosen default template
- template edits (forks/versions) were not reflected in lookups because
  family resolution ignored fork keys and compared versions
  lexicographically (``phlox_10`` < ``phlox_9``)
- soft-deleted template versions were served by ``GET /api/templates/{key}``
  without opt-in
"""

import json
from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.config.user import router as config_user_router
from server.api.templates import router as templates_router
from server.database.config.manager import config_manager
from server.database.core.connection import get_db
from server.database.repositories import templates as repo
from server.schemas.templates import ClinicalTemplate, TemplateField

app = FastAPI()
app.include_router(templates_router, prefix="/api/templates")
app.include_router(config_user_router, prefix="/api/config")
client = TestClient(app)

FIELDS = [
    {
        "field_key": "primary_history",
        "field_name": "Primary History",
        "field_type": "text",
        "persistent": True,
        "system_prompt": "x",
        "initial_prompt": "y",
        "style_example": "- z",
    }
]


def _field(name="Primary History", key="primary_history"):
    return {**FIELDS[0], "field_key": key, "field_name": name}


def _template(key, name=None, field=None):
    return ClinicalTemplate(
        template_key=key,
        template_name=name or key,
        fields=[TemplateField(**(field or _field()))],
    )


def _insert_template(key, name=None, field=None, deleted=False):
    now = datetime.now().isoformat()
    payload = json.dumps(
        [TemplateField(**(field or _field())).model_dump()]
    )
    with get_db().transaction() as cursor:
        cursor.execute(
            "INSERT OR REPLACE INTO clinical_templates "
            "(template_key, template_name, fields, deleted, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (key, name or key, payload, deleted, now, now),
        )


def _delete_template_rows(*keys):
    with get_db().transaction() as cursor:
        for key in keys:
            cursor.execute(
                "DELETE FROM clinical_templates WHERE template_key = ?", (key,)
            )


def test_config_user_save_cannot_clobber_default_template():
    """POST /api/config/user must ignore default_template_key echoes.

    Reproduces: user changes default template, then edits another setting;
    the stale echoed key reverted the default silently.
    """
    original = config_manager.get_default_template_key() or "phlox_01"
    try:
        config_manager.set_default_template_key("phlox_01")
        response = client.post(
            "/api/config/user",
            json={"name": "Dr Test", "default_template_key": "soap_01"},
        )
        assert response.status_code == 200
        assert config_manager.get_default_template_key() == "phlox_01"

        # The dedicated endpoint remains the only writer
        response = client.post("/api/templates/default/soap_01")
        assert response.status_code == 200
        assert config_manager.get_default_template_key() == "soap_01"

        # ...and a later config save must not revert it
        response = client.post(
            "/api/config/user",
            json={"name": "Dr Test", "default_template_key": "phlox_01"},
        )
        assert response.status_code == 200
        assert config_manager.get_default_template_key() == "soap_01"
    finally:
        config_manager.set_default_template_key(original)


def test_family_latest_prefers_fork_over_old_versions():
    """exact_match=False on a fork key returns the fork, not 'custom_%'.

    Reproduces: returning patients whose previous encounter used an old
    version were upgraded to the old protected version instead of the
    user's fork containing their edits.
    """
    # progress_01 is a seeded default; the higher versions and fork here
    # are test-local rows removed again in finally.
    _insert_template("progress_2", "Progress")
    _insert_template("progress_3", "Progress")
    _insert_template(
        "custom_progress_1", "Progress", field=_field("Primary Haematological History")
    )
    try:
        # Family resolution for a fork key (broken split("_")[0] -> "custom")
        resolved = repo.get_template_by_key("custom_progress_1", exact_match=False)
        assert resolved["template_key"] == "custom_progress_1"

        # The fork outranks the newer-looking protected version
        resolved = repo.get_template_by_key("progress_2", exact_match=False)
        assert resolved["template_key"] == "custom_progress_1"
        assert resolved["fields"][0]["field_name"] == "Primary Haematological History"

        # Without a fork, the numerically latest version wins
        _delete_template_rows("custom_progress_1")
        resolved = repo.get_template_by_key("progress_2", exact_match=False)
        assert resolved["template_key"] == "progress_3"
    finally:
        _delete_template_rows("progress_2", "progress_3", "custom_progress_1")


def test_version_bump_beyond_nine_avoids_collision():
    """phlox_9 -> phlox_10 must not collide with soft-deleted rows.

    Lexicographic ORDER BY picked phlox_9 as latest after phlox_10 existed,
    producing a PK collision on the next edit.
    """
    _insert_template("custom_goutreg_9")
    _insert_template("custom_goutreg_10", deleted=True)
    try:
        new_key = repo.update_template(
            _template("custom_goutreg_9", field=_field("Renamed Field"))
        )
        assert new_key == "custom_goutreg_11"
        with get_db().read() as cursor:
            cursor.execute(
                "SELECT deleted FROM clinical_templates WHERE template_key = 'custom_goutreg_10'"
            )
            assert cursor.fetchone()["deleted"] == 1  # untouched
    finally:
        _delete_template_rows(
            "custom_goutreg_9", "custom_goutreg_10", "custom_goutreg_11"
        )


def test_get_template_by_key_hides_deleted_unless_opted_in():
    """Soft-deleted versions are hidden by default and served with include_deleted."""
    _insert_template("haem_review_1", deleted=True)
    try:
        assert repo.get_template_by_key("haem_review_1") is None
        assert (
            repo.get_template_by_key("haem_review_1", include_deleted=True)
            is not None
        )

        response = client.get("/api/templates/haem_review_1")
        assert response.status_code == 404
        response = client.get("/api/templates/haem_review_1?include_deleted=true")
        assert response.status_code == 200
        assert response.json()["template_key"] == "haem_review_1"
    finally:
        _delete_template_rows("haem_review_1")


def test_update_template_moves_default_pointer():
    """Version-bumping the default template repoints the default at the new key."""
    original = config_manager.get_default_template_key() or "phlox_01"
    _insert_template("haem_summary_1")
    try:
        config_manager.set_default_template_key("haem_summary_1")
        new_key = repo.update_template(
            _template("haem_summary_1", field=_field("Renamed Field"))
        )
        assert new_key == "haem_summary_2"
        assert config_manager.get_default_template_key() == "haem_summary_2"
    finally:
        _delete_template_rows("haem_summary_1", "haem_summary_2")
        config_manager.set_default_template_key(original)
