"""
Test basic database functionality using the PatientDatabase.
We are using a temporary directory for testing and cleaning up afterward.
"""

import json
import os
import threading
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
    with test_db.read() as cursor:
        for table in tables:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            row = cursor.fetchone()
            assert row is not None, f"Table {table} not found"


def test_insert_and_retrieve_patient(test_db):
    with test_db.transaction() as cursor:
        cursor.execute(
            """
            INSERT INTO encounters (ur_number, encounter_date)
            VALUES (?, ?)
            """,
            ("UR12345", "2023-06-15"),
        )
        cursor.execute(
            """
            INSERT INTO patient_profiles (ur_number, first_name, last_name, dob, gender)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("UR12345", "John", "Doe", "1990-01-01", "M"),
        )

    with test_db.read() as cursor:
        cursor.execute("SELECT * FROM encounters WHERE ur_number = ?", ("UR12345",))
        patient = cursor.fetchone()
        assert patient is not None
        assert patient["ur_number"] == "UR12345"

        cursor.execute(
            "SELECT first_name, last_name, dob FROM patient_profiles WHERE ur_number = ?",
            ("UR12345",),
        )
        profile = cursor.fetchone()
        assert profile is not None
        assert profile["first_name"] == "John"
        assert profile["last_name"] == "Doe"
        assert profile["dob"] == "1990-01-01"


def test_clear_test_database(test_db):
    # Insert dummy data into a couple of tables
    with test_db.transaction() as cursor:
        cursor.execute("INSERT INTO encounters (ur_number) VALUES (?)", ("Test Patient",))
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
    with test_db.read() as cursor:
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            assert count == 0


def test_transaction_commit_and_rollback(test_db):
    # Test commit
    with test_db.transaction() as cursor:
        cursor.execute("INSERT INTO encounters (ur_number) VALUES (?)", ("UR_COMMIT",))
    with test_db.read() as cursor:
        cursor.execute("SELECT * FROM encounters WHERE ur_number = ?", ("UR_COMMIT",))
        assert cursor.fetchone() is not None

    # Test rollback: a transaction that raises must not persist its write.
    with pytest.raises(RuntimeError), test_db.transaction() as cursor:
        cursor.execute("INSERT INTO encounters (ur_number) VALUES (?)", ("UR_ROLLBACK",))
        raise RuntimeError("deliberate failure")
    with test_db.read() as cursor:
        cursor.execute("SELECT * FROM encounters WHERE ur_number = ?", ("UR_ROLLBACK",))
        assert cursor.fetchone() is None


def test_transaction_rejects_nested_writes_and_rolls_back_base_exceptions(test_db):
    class DeliberateExit(BaseException):
        pass

    with pytest.raises(RuntimeError), test_db.transaction() as cursor:
        cursor.execute("INSERT INTO encounters (ur_number) VALUES (?)", ("UR_OUTER",))
        with test_db.transaction():
            pass

    with pytest.raises(DeliberateExit), test_db.transaction() as cursor:
        cursor.execute("INSERT INTO encounters (ur_number) VALUES (?)", ("UR_EXIT",))
        raise DeliberateExit

    with test_db.read() as cursor:
        cursor.execute(
            "SELECT ur_number FROM encounters WHERE ur_number IN (?, ?)",
            ("UR_OUTER", "UR_EXIT"),
        )
        assert cursor.fetchall() == []


def test_database_connection(test_db):
    # Update check for sqlcipher3 connection
    from sqlcipher3 import dbapi2

    assert isinstance(test_db.db, dbapi2.Connection)
    assert test_db.db.isolation_level is not None


def test_concurrent_transactions_are_isolated(test_db):
    """One thread's rollback must not undo another thread's committed work.

    This is the core regression for the old shared-cursor/shared-transaction
    design, where a connection-level commit/rollback could bleed across
    unrelated operations.
    """
    # Start fresh so counts are predictable.
    test_db.clear_test_database()

    commit_done = threading.Event()
    rollback_done = threading.Event()
    start_both = threading.Event()

    def commit_worker():
        start_both.wait()
        with test_db.transaction() as cursor:
            cursor.execute("INSERT INTO encounters (ur_number) VALUES (?)", ("UR_WIN",))
        commit_done.set()

    def rollback_worker():
        start_both.wait()
        try:
            with test_db.transaction() as cursor:
                cursor.execute("INSERT INTO encounters (ur_number) VALUES (?)", ("UR_LOSE",))
                rollback_done.wait()  # hold the transaction open briefly
                raise RuntimeError("deliberate")
        except RuntimeError:
            pass

    t_commit = threading.Thread(target=commit_worker)
    t_rollback = threading.Thread(target=rollback_worker)
    t_rollback.start()
    t_commit.start()
    # Let both contend for the connection lock, then fail the second writer.
    start_both.set()
    # Give the rollback worker time to start its transaction before releasing.
    threading.Event().wait(0.05)
    rollback_done.set()
    t_commit.join(timeout=10)
    t_rollback.join(timeout=10)

    assert not t_commit.is_alive()
    assert not t_rollback.is_alive()
    assert commit_done.is_set()

    with test_db.read() as cursor:
        cursor.execute(
            "SELECT ur_number FROM encounters WHERE ur_number IN (?, ?)", ("UR_WIN", "UR_LOSE")
        )
        rows = {row["ur_number"] for row in cursor.fetchall()}

    assert "UR_WIN" in rows, "committed work from another thread was lost"
    assert "UR_LOSE" not in rows, "rolled-back work incorrectly persisted"


def test_concurrent_inserts_return_own_ids(test_db):
    """Concurrent writes must each read their own lastrowid, not a sibling's."""
    test_db.clear_test_database()
    results: dict[int, int] = {}
    errors: list[str] = []

    def writer(i: int):
        try:
            with test_db.transaction() as cursor:
                cursor.execute(
                    "INSERT INTO letter_templates (name, instructions) VALUES (?, ?)",
                    (f"concurrent_{i}", "x"),
                )
                results[i] = cursor.lastrowid
        except Exception as e:  # pragma: no cover - surfaced via assertion
            errors.append(repr(e))

    threads = [threading.Thread(target=writer, args=(i,)) for i in range(12)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    assert all(not t.is_alive() for t in threads)
    assert not errors, errors
    assert len(results) == len(threads)
    # Every reported id must map back to the row that thread wrote.
    with test_db.read() as cursor:
        cursor.execute("SELECT id, name FROM letter_templates WHERE name LIKE 'concurrent_%'")
        id_to_name = {row["id"]: row["name"] for row in cursor.fetchall()}

    for i, row_id in results.items():
        assert id_to_name.get(row_id) == f"concurrent_{i}", (
            f"thread {i} got id {row_id} which belongs to {id_to_name.get(row_id)}"
        )


def test_concurrent_adaptive_instruction_updates(test_db, monkeypatch):
    from server.database.repositories import templates

    monkeypatch.setattr(templates, "get_db", lambda: test_db)
    fields = [{"field_key": "assessment"}, {"field_key": "plan"}]
    with test_db.transaction() as cursor:
        cursor.execute(
            """
            INSERT INTO clinical_templates
                (template_key, template_name, fields, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("concurrent_01", "Concurrent", json.dumps(fields), "now", "now"),
        )

    start = threading.Event()
    results = []

    def update(field_key):
        start.wait()
        results.append(
            templates.update_field_adaptive_instructions(
                "concurrent_01", field_key, [f"Keep {field_key}"]
            )
        )

    threads = [
        threading.Thread(target=update, args=("assessment",)),
        threading.Thread(target=update, args=("plan",)),
    ]
    for thread in threads:
        thread.start()
    start.set()
    for thread in threads:
        thread.join(timeout=10)

    assert all(not thread.is_alive() for thread in threads)
    assert results == [True, True]
    with test_db.read() as cursor:
        cursor.execute(
            "SELECT fields FROM clinical_templates WHERE template_key = ?", ("concurrent_01",)
        )
        updated = {field["field_key"]: field for field in json.loads(cursor.fetchone()["fields"])}

    assert updated["assessment"]["adaptive_refinement_instructions"] == ["Keep assessment"]
    assert updated["plan"]["adaptive_refinement_instructions"] == ["Keep plan"]
