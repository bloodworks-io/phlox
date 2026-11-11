"""Audit log repository.

Stores HTTP request metadata (method, route template, status, actor, IP,
duration) for compliance auditing. Raw URL identifiers are never stored: the
path column holds the route template (e.g. /api/note/id/{id}) and patient/note
IDs are kept only as a keyed HMAC pseudonym in ``subject_ref``. Request bodies
and note content are never stored.

Per-request middleware events go through a small batch queue.
"""

import asyncio
import hashlib
import hmac
import logging
import threading
from collections import deque
from typing import Any

from server.database.config.manager import config_manager
from server.database.core.connection import get_db, is_db_initialized

logger = logging.getLogger(__name__)

DEFAULT_RETENTION_DAYS = 90

# Path params that identify a patient/note and are pseudonymised into subject_ref.
SUBJECT_PARAMS = frozenset({"id", "note_id", "patient_id", "ur_number"})
_SUBJECT_KEY_LABEL = b"phlox-audit-subject-ref-v1"
_subject_key: bytes | None = None


def _get_subject_key() -> bytes:
    """HMAC key for subject_ref, derived from the DB encryption key.

    Domain-separated with a fixed label so the derived key is never the
    encryption key itself. Not stored anywhere; recomputed per process.
    """
    global _subject_key
    if _subject_key is None:
        secret = get_db().encryption_key
        if not secret:
            raise RuntimeError("no database encryption key available for audit HMAC")
        _subject_key = hmac.new(secret.encode(), _SUBJECT_KEY_LABEL, hashlib.sha256).digest()
    return _subject_key


def subject_ref(path_params: dict[str, Any] | None) -> str | None:
    """Keyed HMAC-SHA256 pseudonym of the patient/note IDs in ``path_params``.

    Returns None when the route carries no subject identifier or the DB is not
    initialized. An auditor holding the key can recompute the pseudonym for a
    known ID to find accesses; the stored value alone does not reveal the ID.
    """
    if not path_params or not is_db_initialized():
        return None
    parts = [f"{k}={path_params[k]}" for k in sorted(path_params) if k in SUBJECT_PARAMS]
    if not parts:
        return None
    try:
        key = _get_subject_key()
    except Exception as e:  # pragma: no cover - audit must never break the request
        logger.warning("audit subject_ref unavailable: %s", type(e).__name__)
        return None
    return hmac.new(key, "&".join(parts).encode(), hashlib.sha256).hexdigest()


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
    subject_ref: str | None = None,
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
            "subject_ref": subject_ref,
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
                    INSERT INTO audit_log
                        (actor, method, path, status, client_ip, duration_ms, subject_ref)
                    VALUES (:actor, :method, :path, :status, :client_ip, :duration_ms,
                            :subject_ref)
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
                    INSERT INTO audit_log
                        (actor, method, path, status, client_ip, duration_ms, subject_ref)
                    VALUES (:actor, :method, :path, :status, :client_ip, :duration_ms,
                            :subject_ref)
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
    subject_ref: str | None = None,
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
                INSERT INTO audit_log
                    (actor, method, path, status, client_ip, duration_ms, subject_ref)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (actor, method, path, status, client_ip, duration_ms, subject_ref),
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
                SELECT id, timestamp, actor, method, path, status, client_ip, duration_ms,
                       subject_ref
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
