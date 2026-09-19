"""User accounts, sessions, and ownership claiming."""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from typing import Any

from server.constants import is_protected_template_key
from server.database.core.connection import get_db

logger = logging.getLogger(__name__)

SESSION_DAYS = 30
IMPLICIT_ADMIN_USERNAME = "local"


def create_user(
    username: str,
    password_hash: bytes | None = None,
    salt: bytes | None = None,
    role: str = "clinician",
) -> int:
    with get_db().transaction() as cursor:
        cursor.execute(
            "INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)",
            (username, password_hash, salt, role),
        )
        return cursor.lastrowid


def get_user_by_username(username: str) -> dict[str, Any] | None:
    with get_db().read() as cursor:
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    with get_db().read() as cursor:
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def list_users() -> list[dict[str, Any]]:
    with get_db().read() as cursor:
        cursor.execute(
            "SELECT id, username, role, disabled, created_at FROM users ORDER BY username"
        )
        return [dict(row) for row in cursor.fetchall()]


def count_real_users() -> int:
    """Users that can log in (password or OIDC); excludes the implicit desktop admin."""
    with get_db().read() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM users WHERE password_hash IS NOT NULL OR oidc_sub IS NOT NULL"
        )
        return cursor.fetchone()[0]


def set_password(user_id: int, password_hash: bytes, salt: bytes) -> None:
    with get_db().transaction() as cursor:
        cursor.execute(
            "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
            (password_hash, salt, user_id),
        )


def set_disabled(user_id: int, disabled: bool) -> None:
    with get_db().transaction() as cursor:
        cursor.execute("UPDATE users SET disabled = ? WHERE id = ?", (disabled, user_id))
        if disabled:
            cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))


# Sessions


def _hash_token(raw_token: str) -> bytes:
    return hashlib.sha256(raw_token.encode()).digest()


def create_session(user_id: int, days: int = SESSION_DAYS, label: str | None = None) -> str:
    """Mint a session; returns the raw token once (only its hash is stored)."""
    token = secrets.token_hex(32)
    expires = (datetime.now() + timedelta(days=days)).isoformat()
    with get_db().transaction() as cursor:
        cursor.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at, label) VALUES (?, ?, ?, ?)",
            (_hash_token(token), user_id, expires, label),
        )
    return token


def get_user_for_session(raw_token: str) -> dict[str, Any] | None:
    """Resolve a raw token to its (non-disabled, non-expired) user, else None."""
    with get_db().read() as cursor:
        cursor.execute(
            """
            SELECT u.* FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            """,
            (_hash_token(raw_token), datetime.now().isoformat()),
        )
        row = cursor.fetchone()
        if not row or row["disabled"]:
            return None
        return dict(row)


def delete_session(raw_token: str) -> None:
    with get_db().transaction() as cursor:
        cursor.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(raw_token),))


def purge_expired_sessions() -> int:
    with get_db().transaction() as cursor:
        cursor.execute("DELETE FROM sessions WHERE expires_at <= ?", (datetime.now().isoformat(),))
        return cursor.rowcount


# Desktop / allow-unauthenticated modes


def ensure_implicit_admin() -> dict[str, Any]:
    """Create the passwordless 'local' admin if no real users exist; claim NULL rows."""
    user = get_user_by_username(IMPLICIT_ADMIN_USERNAME)
    if user is None:
        user_id = create_user(IMPLICIT_ADMIN_USERNAME, role="admin")
        user = get_user_by_id(user_id)
        logger.info("Created implicit admin user '%s'", IMPLICIT_ADMIN_USERNAME)
    assert user is not None  # noqa: S101 - just created or fetched by unique username
    claim_unowned(user["id"])
    return user


def claim_unowned(user_id: int) -> None:
    """Attach all legacy NULL-owned rows to the given user (first-run claim)."""
    with get_db().transaction() as cursor:
        cursor.execute("UPDATE encounters SET created_by = ? WHERE created_by IS NULL", (user_id,))
        # Seeded letter templates stay NULL-owned (shared); user-created ones
        # are owned from creation.
        cursor.execute("UPDATE todos SET owner_id = ? WHERE owner_id IS NULL", (user_id,))
        cursor.execute("UPDATE user_settings SET user_id = ? WHERE user_id IS NULL", (user_id,))
        # Protected/system templates stay shared (owner NULL); claim user-created customs only.
        cursor.execute("SELECT template_key FROM clinical_templates WHERE owner_id IS NULL")
        for row in cursor.fetchall():
            key = row["template_key"]
            if not is_protected_template_key(key):
                cursor.execute(
                    "UPDATE clinical_templates SET owner_id = ? WHERE template_key = ?",
                    (user_id, key),
                )
    _claim_unowned_collections(user_id)


def _claim_unowned_collections(user_id: int) -> None:
    """Claim NULL-owned RAG collections in documents.sqlite. Best-effort."""
    try:
        import sqlite3 as plain_sqlite

        from server.constants import DATA_DIR

        db_path = DATA_DIR / "documents.sqlite"
        if not db_path.exists():
            return
        db = plain_sqlite.connect(str(db_path))
        try:
            cols = [r[1] for r in db.execute("PRAGMA table_info(collections)").fetchall()]
            if "owner_id" not in cols:
                # Vector backend not initialised yet (no RAG use). Add the
                # column here so the claim still lands; its own guarded add
                # is a no-op afterwards.
                db.execute("ALTER TABLE collections ADD COLUMN owner_id INTEGER")
            db.execute("UPDATE collections SET owner_id = ? WHERE owner_id IS NULL", (user_id,))
            db.commit()
        finally:
            db.close()
    except Exception as e:  # pragma: no cover - never break startup/claim on RAG hiccups
        logger.warning("Could not claim RAG collections: %s", e)
