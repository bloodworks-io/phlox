"""Repo-level tests for encounter get_latest_encounter + get_patient_notes."""

import json
import os

import pytest

from server.database.core.connection import PatientDatabase
from server.database.repositories import encounter


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
