"""
Test basic database functionality using the PatientDatabase.
We are using a temporary directory for testing and cleaning up afterward.
"""

import os
from pathlib import Path

import pytest

from server.database.core.connection import PatientDatabase


@pytest.fixture(scope="module")
def test_db(tmp_path_factory):
    # Use a temporary directory for the database
    temp_dir = tmp_path_factory.mktemp("data")
    os.environ["DB_ENCRYPTION_KEY"] = "test_key"
    os.environ["TESTING"] = "true"
    db = PatientDatabase(db_dir=str(temp_dir))
    yield db
    # Cleanup: clear test database and remove temporary file
    db.clear_test_database()
    db.close()
    if Path(db.db_path).exists():
        Path(db.db_path).unlink()


def test_database_initialization(test_db):
    assert test_db.is_test is True
    assert "test_phlox_database.sqlite" in test_db.db_path
    assert Path(test_db.db_path).exists()


def test_create_tables(test_db):
    tables = [
        "encounters",
        "patient_profiles",
        "clinical_templates",
        "todos",
        "config",
        "prompts",
        "options",
        "user_settings",
        "letter_templates",
        "mcp_servers",
    ]
    for table in tables:
        test_db.cursor.execute(
            f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'"
        )
        row = test_db.cursor.fetchone()
        assert row is not None, f"Table {table} not found"


def test_insert_and_retrieve_patient(test_db):
    test_db.cursor.execute(
        """
        INSERT INTO encounters (ur_number, encounter_date)
        VALUES (?, ?)
        """,
        ("UR12345", "2023-06-15"),
    )
    test_db.cursor.execute(
        """
        INSERT INTO patient_profiles (ur_number, first_name, last_name, dob, gender)
        VALUES (?, ?, ?, ?, ?)
        """,
        ("UR12345", "John", "Doe", "1990-01-01", "M"),
    )
    test_db.db.commit()

    test_db.cursor.execute("SELECT * FROM encounters WHERE ur_number = ?", ("UR12345",))
    patient = test_db.cursor.fetchone()
    assert patient is not None
    assert patient["ur_number"] == "UR12345"

    test_db.cursor.execute(
        "SELECT first_name, last_name, dob FROM patient_profiles WHERE ur_number = ?",
        ("UR12345",),
    )
    profile = test_db.cursor.fetchone()
    assert profile is not None
    assert profile["first_name"] == "John"
    assert profile["last_name"] == "Doe"
    assert profile["dob"] == "1990-01-01"


def test_clear_test_database(test_db):
    # Insert dummy data into a couple of tables
    test_db.cursor.execute("INSERT INTO encounters (ur_number) VALUES (?)", ("Test Patient",))
    test_db.db.commit()
    # Now clear the database
    test_db.clear_test_database()
    tables = [
        "encounters",
        "patient_profiles",
        "clinical_templates",
        "todos",
        "config",
        "prompts",
        "options",
    ]
    for table in tables:
        test_db.cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = test_db.cursor.fetchone()[0]
        assert count == 0


def test_commit_and_rollback(test_db):
    # Test commit
    test_db.cursor.execute("INSERT INTO encounters (ur_number) VALUES (?)", ("UR_COMMIT",))
    test_db.commit()
    test_db.cursor.execute("SELECT * FROM encounters WHERE ur_number = ?", ("UR_COMMIT",))
    assert test_db.cursor.fetchone() is not None

    # Test rollback by intentionally inserting and not committing
    test_db.cursor.execute("INSERT INTO encounters (ur_number) VALUES (?)", ("UR_ROLLBACK",))
    test_db.db.rollback()
    test_db.cursor.execute("SELECT * FROM encounters WHERE ur_number = ?", ("UR_ROLLBACK",))
    assert test_db.cursor.fetchone() is None


def test_database_connection(test_db):
    # Update check for sqlcipher3 connection
    from sqlcipher3 import dbapi2

    assert isinstance(test_db.db, dbapi2.Connection)
    assert test_db.db.isolation_level is not None
