"""Migration v10: user accounts, sessions, and per-user ownership columns."""


def migrate(cursor, _db):
    """Create users/sessions and add ownership columns to existing tables."""
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT NOT NULL UNIQUE,
            password_hash BLOB,
            salt          BLOB,
            role          TEXT NOT NULL DEFAULT 'clinician',
            disabled      BOOLEAN NOT NULL DEFAULT FALSE,
            oidc_sub      TEXT,
            issuer        TEXT,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash BLOB PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            label      TEXT
        )
        """
    )

    cursor.execute("ALTER TABLE encounters ADD COLUMN created_by INTEGER")
    cursor.execute("ALTER TABLE clinical_templates ADD COLUMN owner_id INTEGER")
    cursor.execute("ALTER TABLE letter_templates ADD COLUMN owner_id INTEGER")
    cursor.execute("ALTER TABLE todos ADD COLUMN owner_id INTEGER")
    cursor.execute("ALTER TABLE user_settings ADD COLUMN user_id INTEGER")

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_encounters_created_by ON encounters(created_by)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)")
