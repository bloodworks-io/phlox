"""Audit log repository.

Stores HTTP request metadata (method, path, status, actor, IP, duration) for
compliance auditing. Records identifiers from the URL path but never request
bodies or note content.

Per-request middleware events go through a small batch queue.
"""

import asyncio
import logging
import threading
from collections import deque
from typing import Any

from server.database.config.manager import config_manager
from server.database.core.connection import get_db, is_db_initialized

logger = logging.getLogger(__name__)

DEFAULT_RETENTION_DAYS = 90

# Batch queue bounds: drop-oldest under pathological bursts (audit is
# documented best-effort), and coalesce writes on a short delay.
_AUDIT_QUEUE_MAX = 2000
_AUDIT_FLUSH_DELAY = 0.5

_audit_queue: deque = deque(maxlen=_AUDIT_QUEUE_MAX)
_batch_lock = threading.Lock()  # one batch writer at a time
_state_lock = threading.Lock()  # guards the pending flush handle
_flush_handle: asyncio.TimerHandle | None = None
_dropped_batches = 0


def enqueue_event(
    *,
    method: str,
    path: str,
    status: int,
    actor: str = "local",
    client_ip: str | None = None,
    duration_ms: int | None = None,
) -> None:
    """Queue one audit row for the next batch flush. Never touches the DB.

    Must be called from the event loop (the audit middleware's dispatch);
    the flush itself runs on the default executor.
    """
    global _dropped_batches

    if not is_db_initialized():
        return
    if len(_audit_queue) == _audit_queue.maxlen and _dropped_batches < 1:
        # Warn once per overflow episode (reset below on drain).
        _dropped_batches = 1
        logger.warning(
            "audit queue overflow (%d events); dropping oldest audit rows",
            _AUDIT_QUEUE_MAX,
        )
    _audit_queue.append(
        {
            "method": method,
            "path": path,
            "status": status,
            "actor": actor,
            "client_ip": client_ip,
            "duration_ms": duration_ms,
        }
    )
    _schedule_flush()


def _schedule_flush() -> None:
    """Arm a single timer that flushes the queue shortly after the first
    pending event; further enqueues inside the window coalesce into it."""
    global _flush_handle

    loop = asyncio.get_running_loop()
    with _state_lock:
        if _flush_handle is not None:
            return
        _flush_handle = loop.call_later(_AUDIT_FLUSH_DELAY, _flush_from_loop)


def _flush_from_loop() -> None:
    """Timer callback (loop thread): move the batch write off the loop."""
    global _flush_handle

    with _state_lock:
        _flush_handle = None
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _drain_and_write_batch)


def _drain_and_write_batch() -> None:
    """Pop every queued row and insert it in one transaction. Never raises."""
    global _dropped_batches

    with _batch_lock:
        rows = []
        while _audit_queue:
            rows.append(_audit_queue.popleft())
        if not rows:
            return
        _dropped_batches = 0
        try:
            with get_db().transaction() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO audit_log (actor, method, path, status, client_ip, duration_ms)
                    VALUES (:actor, :method, :path, :status, :client_ip, :duration_ms)
                    """,
                    rows,
                )
        except Exception as e:  # pragma: no cover - audit must never break the request
            logger.warning("audit batch flush failed (%d events dropped): %s", len(rows), e)


def flush_events_sync() -> int:
    """Write any queued events immediately. Returns rows written (tests,
    shutdown best-effort flush)."""
    with _batch_lock:
        rows = []
        while _audit_queue:
            rows.append(_audit_queue.popleft())
        if not rows:
            return 0
        try:
            with get_db().transaction() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO audit_log (actor, method, path, status, client_ip, duration_ms)
                    VALUES (:actor, :method, :path, :status, :client_ip, :duration_ms)
                    """,
                    rows,
                )
        except Exception as e:  # pragma: no cover
            logger.warning("audit flush_events_sync failed (%d events dropped): %s", len(rows), e)
            return 0
    return len(rows)


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
    if days < 1:
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
