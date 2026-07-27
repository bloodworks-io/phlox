"""Migration v7: audit_log table and retention config seed."""

import json


def migrate(cursor, _db):
    """Add audit_log table and seed AUDIT_RETENTION_DAYS config."""
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            actor TEXT NOT NULL DEFAULT 'local',
            method TEXT NOT NULL,
            path TEXT NOT NULL,
            status INTEGER NOT NULL,
            client_ip TEXT,
            duration_ms INTEGER
        )
    """
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)")

    cursor.execute(
        "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)",
        ("AUDIT_RETENTION_DAYS", json.dumps(90)),
    )
