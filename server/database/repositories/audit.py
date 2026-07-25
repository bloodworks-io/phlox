"""Audit log repository.

Stores HTTP request metadata (method, path, status, actor, IP, duration) for
compliance auditing. Records identifiers from the URL path but never request
bodies or note content.
"""

import logging
from typing import Any

from server.database.config.manager import config_manager
from server.database.core.connection import get_db, is_db_initialized

logger = logging.getLogger(__name__)

DEFAULT_RETENTION_DAYS = 90


def log_event(
    *,
    method: str,
    path: str,
    status: int,
    actor: str = "local",
    client_ip: str | None = None,
    duration_ms: int | None = None,
) -> None:
    """Insert one audit row. Never raises — audit failure must not fail the request.

    No-ops if the DB is not yet initialized (desktop pre-passphrase startup).
    """
    if not is_db_initialized():
        return
    try:
        with get_db().transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO audit_log (actor, method, path, status, client_ip, duration_ms)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (actor, method, path, status, client_ip, duration_ms),
            )
    except Exception as e:  # pragma: no cover - audit must never break the request
        logger.warning("audit log_event failed: %s", e)


def get_events(
    *,
    limit: int = 200,
    offset: int = 0,
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[dict[str, Any]]:
    """Page through audit events newest-first."""
    try:
        with get_db().read() as cursor:
            where = []
            params: list[Any] = []
            if from_date:
                where.append("timestamp >= ?")
                params.append(from_date)
            if to_date:
                where.append("timestamp <= ?")
                params.append(to_date)
            clause = f"WHERE {' AND '.join(where)}" if where else ""
            params.extend([limit, offset])
            cursor.execute(
                f"""
                SELECT id, timestamp, actor, method, path, status, client_ip, duration_ms
                FROM audit_log {clause}
                ORDER BY timestamp DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                params,
            )
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        logger.error("audit get_events failed: %s", e)
        raise


def purge_old_events() -> int:
    """Delete rows older than AUDIT_RETENTION_DAYS. Returns count deleted."""
    if not is_db_initialized():
        return 0
    try:
        days = int(config_manager.get_config().get("AUDIT_RETENTION_DAYS", DEFAULT_RETENTION_DAYS))
    except Exception:
        days = DEFAULT_RETENTION_DAYS
    try:
        with get_db().transaction() as cursor:
            cursor.execute(
                "DELETE FROM audit_log WHERE timestamp < datetime('now', ?)",
                (f"-{days} days",),
            )
            return cursor.rowcount
    except Exception as e:  # pragma: no cover
        logger.warning("audit purge_old_events failed: %s", e)
        return 0
