"""Repo-level tests for encounter get_latest_encounter + get_patient_notes."""

import json
import os

import pytest

from server.database.core.connection import PatientDatabase
from server.database.repositories import encounter
from server.database.repositories import templates as templates_repo


@pytest.fixture(scope="module")
def test_db(tmp_path_factory):
    temp_dir = tmp_path_factory.mktemp("data")
    os.environ["DB_ENCRYPTION_KEY"] = "test_key"
    os.environ["TESTING"] = "true"
    db = PatientDatabase(db_dir=str(temp_dir))
    yield db
    db.clear_test_database()
    db.close()


def test_get_latest_encounter_returns_most_recent(test_db, monkeypatch):
    test_db.clear_test_database()
    monkeypatch.setattr(encounter, "get_db", lambda: test_db)
    with test_db.transaction() as cursor:
        for d in ("2024-01-01", "2024-06-01", "2024-03-01"):
            cursor.execute(
                "INSERT INTO encounters (ur_number, encounter_date) VALUES (?, ?)",
                ("UR1", d),
            )
    row = encounter.get_latest_encounter("UR1")
    assert row is not None
    assert row["encounter_date"] == "2024-06-01"


def test_get_latest_encounter_exclude_date(test_db, monkeypatch):
    test_db.clear_test_database()
    monkeypatch.setattr(encounter, "get_db", lambda: test_db)
    with test_db.transaction() as cursor:
        for d in ("2024-01-01", "2024-06-01"):
            cursor.execute(
                "INSERT INTO encounters (ur_number, encounter_date) VALUES (?, ?)",
                ("UR1", d),
            )
    row = encounter.get_latest_encounter("UR1", exclude_date="2024-06-01")
    assert row is not None
    assert row["encounter_date"] == "2024-01-01"


def test_get_latest_encounter_none_when_no_match(test_db, monkeypatch):
    test_db.clear_test_database()
    monkeypatch.setattr(encounter, "get_db", lambda: test_db)
    assert encounter.get_latest_encounter("NOPE") is None


def test_get_patient_notes_by_ur(test_db, monkeypatch):
    test_db.clear_test_database()
    monkeypatch.setattr(encounter, "get_db", lambda: test_db)
    with test_db.transaction() as cursor:
        cursor.execute(
            "INSERT INTO patient_profiles (ur_number, first_name, last_name, dob) "
            "VALUES (?, ?, ?, ?)",
            ("UR1", "John", "Smith", "1990-01-01"),
        )
        cursor.execute(
            "INSERT INTO encounters "
            "(ur_number, encounter_date, template_data, raw_transcription, "
            "encounter_summary, final_letter) VALUES (?, ?, ?, ?, ?, ?)",
            ("UR1", "2024-01-01", json.dumps({"plan": "review"}), "raw", "summary", "letter"),
        )
    rows = encounter.get_patient_notes(ur_number="UR1")
    assert len(rows) == 1
    r = rows[0]
    assert r["template_data"] == json.dumps({"plan": "review"})
    assert r["raw_transcription"] == "raw"
    assert r["encounter_summary"] == "summary"
    assert r["final_letter"] == "letter"
    assert r["first_name"] == "John"
    assert r["last_name"] == "Smith"
    assert r["dob"] == "1990-01-01"


def test_get_patient_notes_by_name(test_db, monkeypatch):
    test_db.clear_test_database()
    monkeypatch.setattr(encounter, "get_db", lambda: test_db)
    with test_db.transaction() as cursor:
        cursor.execute(
            "INSERT INTO patient_profiles (ur_number, first_name, last_name) VALUES (?, ?, ?)",
            ("UR1", "John", "Smith"),
        )
        cursor.execute(
            "INSERT INTO encounters (ur_number, encounter_date) VALUES (?, ?)",
            ("UR1", "2024-01-01"),
        )
    rows = encounter.get_patient_notes(patient_name="smith")
    assert len(rows) == 1
    assert rows[0]["ur_number"] == "UR1"


def test_get_patient_notes_requires_one_param(test_db, monkeypatch):
    test_db.clear_test_database()
    monkeypatch.setattr(encounter, "get_db", lambda: test_db)
    assert encounter.get_patient_notes() == []


def _seed_history_family(test_db, monkeypatch):
    """Seed a fresh DB with one encounter per template key; return repo patched to test_db."""
    test_db.clear_test_database()
    monkeypatch.setattr(encounter, "get_db", lambda: test_db)
    monkeypatch.setattr(templates_repo, "get_db", lambda: test_db)
    _seed_template_rows(
        test_db, "phlox_01", "phlox_05", "custom_phlox_1", "soap_01", "custom_phlox_things_1"
    )
    with test_db.transaction() as cursor:
        for i, key in enumerate(("phlox_01", "phlox_05", "custom_phlox_1", "soap_01")):
            cursor.execute(
                "INSERT INTO encounters (ur_number, encounter_date, template_key, template_data) "
                "VALUES (?, ?, ?, ?)",
                ("UR1", f"2024-0{i + 1}-01", key, json.dumps({"plan": f"note-{key}"})),
            )


def _seed_template_rows(test_db, *keys):
    """Insert minimal clinical_templates rows so encounter template lookups resolve."""
    now = "2024-01-01T00:00:00"
    with test_db.transaction() as cursor:
        for key in keys:
            cursor.execute(
                "INSERT OR REPLACE INTO clinical_templates "
                "(template_key, template_name, fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (key, key, json.dumps([]), now, now),
            )


def test_history_family_spans_versions_and_forks(test_db, monkeypatch):
    """custom_phlox / phlox queries return the whole phlox lineage, including legacy user edits."""
    _seed_history_family(test_db, monkeypatch)
    for query_key in ("phlox_01", "phlox_05", "custom_phlox_1", "phlox"):
        rows = encounter.get_patient_history("UR1", query_key)
        keys = {r["template_key"] for r in rows}
        assert keys == {"phlox_01", "phlox_05", "custom_phlox_1"}, (
            f"query '{query_key}' returned {keys}"
        )


def test_history_family_excludes_unrelated_and_other_templates(test_db, monkeypatch):
    _seed_history_family(test_db, monkeypatch)
    rows = encounter.get_patient_history("UR1", "soap_01")
    assert {r["template_key"] for r in rows} == {"soap_01"}

    # Unrelated /generate name that merely starts with "custom_phlox"
    with test_db.transaction() as cursor:
        cursor.execute(
            "INSERT INTO encounters (ur_number, encounter_date, template_key) VALUES (?, ?, ?)",
            ("UR1", "2024-05-01", "custom_phlox_things_1"),
        )
    rows = encounter.get_patient_history("UR1", "custom_phlox_things_1")
    assert {r["template_key"] for r in rows} == {"custom_phlox_things_1"}


def test_history_family_plain_custom_base_stays_isolated(test_db, monkeypatch):
    """A generic custom template (custom_cardiology_1) matches only itself."""
    test_db.clear_test_database()
    monkeypatch.setattr(encounter, "get_db", lambda: test_db)
    monkeypatch.setattr(templates_repo, "get_db", lambda: test_db)
    _seed_template_rows(test_db, "custom_cardiology_1", "cardiology_1")
    with test_db.transaction() as cursor:
        cursor.execute(
            "INSERT INTO encounters (ur_number, encounter_date, template_key) VALUES (?, ?, ?)",
            ("UR1", "2024-01-01", "custom_cardiology_1"),
        )
        cursor.execute(
            "INSERT INTO encounters (ur_number, encounter_date, template_key) VALUES (?, ?, ?)",
            ("UR1", "2024-02-01", "cardiology_1"),
        )
    rows = encounter.get_patient_history("UR1", "custom_cardiology_1")
    assert {r["template_key"] for r in rows} == {"custom_cardiology_1"}
