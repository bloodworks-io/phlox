"""Migration v11: note citation storage + companion-sync bookkeeping."""

import logging


def _ensure_column(cursor, table: str, column: str, ddl: str) -> None:
    columns = {row[1] for row in cursor.execute(f"PRAGMA table_info({table})")}
    if column not in columns:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def migrate(cursor, _db):
    """Add nullable note_citations JSON column to encounters, and companion app items"""
    cursor.execute(
        """
        ALTER TABLE encounters
        ADD COLUMN note_citations JSON
        """
    )
    logging.info("Added encounters.note_citations")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS companion_patients (
            guid TEXT PRIMARY KEY,
            ur_number TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS companion_sessions (
            session_guid TEXT PRIMARY KEY,
            encounter_id INTEGER,
            status TEXT NOT NULL DEFAULT 'processing',
            error TEXT,
            imported_at TIMESTAMP
        )
        """
    )
    for column, ddl in [
        ("received_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ("device_id", "TEXT"),
        ("patient_display_name", "TEXT"),
        ("patient_ur_number", "TEXT"),
        ("started_at", "TIMESTAMP"),
        ("ended_at", "TIMESTAMP"),
        ("utterance_count", "INTEGER"),
        ("document", "JSON"),
    ]:
        _ensure_column(cursor, "companion_sessions", column, ddl)
    logging.info("Added companion sync tables")
