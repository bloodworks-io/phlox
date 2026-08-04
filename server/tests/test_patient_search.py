"""Repo-level tests for patient_search aggregate + name-index lookups."""

import os

import pytest

from server.database.core.connection import PatientDatabase
from server.database.repositories import patient_search


@pytest.fixture(scope="module")
def test_db(tmp_path_factory):
    temp_dir = tmp_path_factory.mktemp("data")
    os.environ["DB_ENCRYPTION_KEY"] = "test_key"
    os.environ["TESTING"] = "true"
    db = PatientDatabase(db_dir=str(temp_dir))
    yield db
    db.clear_test_database()
    db.close()


def _seed(db, ur_number, first, last, dob, dates):
    """Insert a profile plus one encounter per encounter_date."""
    with db.transaction() as cursor:
        cursor.execute(
            "INSERT INTO patient_profiles (ur_number, first_name, last_name, dob) "
            "VALUES (?, ?, ?, ?)",
            (ur_number, first, last, dob),
        )
        for d in dates:
            cursor.execute(
                "INSERT INTO encounters (ur_number, encounter_date) VALUES (?, ?)",
                (ur_number, d),
            )


def test_search_patients_aggregate_by_name(test_db, monkeypatch):
    test_db.clear_test_database()
    monkeypatch.setattr(patient_search, "get_db", lambda: test_db)
    _seed(test_db, "UR1", "John", "Smith", "1990-01-01", ["2024-01-01", "2024-06-01"])
    _seed(test_db, "UR2", "Jane", "Doe", "1985-02-02", ["2024-03-01"])

    rows = patient_search.search_patients_aggregate(name="smith")
    assert len(rows) == 1
    r = rows[0]
    assert r["ur_number"] == "UR1"
    assert r["name"] == "Smith, John"
    assert r["last_encounter"] == "2024-06-01"
    assert r["encounter_count"] == 2


def test_search_patients_aggregate_respects_limit(test_db, monkeypatch):
    test_db.clear_test_database()
    monkeypatch.setattr(patient_search, "get_db", lambda: test_db)
    for i in range(5):
        _seed(test_db, f"UR{i}", "A", f"Last{i}", "2000-01-01", ["2024-01-01"])

    rows = patient_search.search_patients_aggregate(limit=2)
    assert len(rows) == 2


def test_search_patients_aggregate_no_matches(test_db, monkeypatch):
    test_db.clear_test_database()
    monkeypatch.setattr(patient_search, "get_db", lambda: test_db)
    _seed(test_db, "UR1", "John", "Smith", "1990-01-01", ["2024-01-01"])
    assert patient_search.search_patients_aggregate(name="nonexistent") == []


def test_get_patient_name_index_includes_profile_without_encounter(test_db, monkeypatch):
    """Profiles with no encounter are now resolvable (broadened from encounters-only)."""
    test_db.clear_test_database()
    monkeypatch.setattr(patient_search, "get_db", lambda: test_db)
    with test_db.transaction() as cursor:
        cursor.execute(
            "INSERT INTO patient_profiles (ur_number, first_name, last_name) VALUES (?, ?, ?)",
            ("UR_NOENC", "Never", "Seen"),
        )

    rows = patient_search.get_patient_name_index()
    assert any(r["ur_number"] == "UR_NOENC" for r in rows)


def test_get_patient_name_index_excludes_empty_ur(test_db, monkeypatch):
    test_db.clear_test_database()
    monkeypatch.setattr(patient_search, "get_db", lambda: test_db)
    with test_db.transaction() as cursor:
        cursor.execute(
            "INSERT INTO patient_profiles (ur_number, first_name, last_name) VALUES (?, ?, ?)",
            ("", "Empty", "UR"),
        )
    rows = patient_search.get_patient_name_index()
    assert all(r["ur_number"] for r in rows)
