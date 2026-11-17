"""Persistence for companion-sync bookkeeping tables."""

import json
import logging
from datetime import datetime
from typing import Any

from server.database.core.connection import get_db

logger = logging.getLogger(__name__)


def _json(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value)


def get_mapped_ur_number(guid: str) -> str | None:
    """The ur_number a phone-minted patient GUID maps to, if any."""
    try:
        with get_db().read() as cursor:
            cursor.execute("SELECT ur_number FROM companion_patients WHERE guid = ?", (guid,))
            row = cursor.fetchone()
            return row["ur_number"] if row else None
    except Exception as e:
        logger.error(f"companion: patient mapping lookup failed: {e}")
        return None


def map_patient(guid: str, ur_number: str) -> None:
    """Bind a phone GUID to a ur_number."""
    try:
        with get_db().transaction() as cursor:
            cursor.execute(
                "INSERT OR IGNORE INTO companion_patients (guid, ur_number) VALUES (?, ?)",
                (guid, ur_number),
            )
    except Exception as e:
        logger.error(f"companion: patient mapping write failed: {e}")
        raise


def ur_number_exists(ur_number: str) -> bool:
    """True when the ur_number is known to profiles or encounters."""
    try:
        with get_db().transaction() as cursor:
            profile = cursor.execute(
                "SELECT 1 FROM patient_profiles WHERE ur_number = ?", (ur_number,)
            ).fetchone()
            if profile:
                return True
            encounter = cursor.execute(
                "SELECT 1 FROM encounters WHERE ur_number = ? LIMIT 1", (ur_number,)
            ).fetchone()
            return encounter is not None
    except Exception as e:
        logger.error(f"companion: ur_number existence check failed: {e}")
        return False


def get_import(session_guid: str) -> dict[str, Any] | None:
    try:
        with get_db().read() as cursor:
            cursor.execute(
                "SELECT * FROM companion_sessions WHERE session_guid = ?",
                (session_guid,),
            )
            row = cursor.fetchone()
            return dict(row) if row else None
    except Exception as e:
        logger.error(f"companion: import lookup failed: {e}")
        return None


def start_import(
    session_guid: str,
    metadata: dict[str, Any] | None = None,
    status: str = "processing",
) -> bool:
    """Claim a session ('processing' for immediate import, 'received' when
    holding for batch), recording its manifest metadata and the raw document
    (kept for retries). False when it was already claimed."""
    metadata = metadata or {}
    try:
        with get_db().transaction() as cursor:
            cursor.execute(
                "INSERT OR IGNORE INTO companion_sessions (session_guid, status,"
                " device_id, patient_display_name, patient_ur_number, started_at,"
                " ended_at, utterance_count, document)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    session_guid,
                    status,
                    metadata.get("device_id"),
                    metadata.get("patient_display_name"),
                    metadata.get("patient_ur_number"),
                    metadata.get("started_at"),
                    metadata.get("ended_at"),
                    metadata.get("utterance_count"),
                    _json(metadata.get("document")),
                ),
            )
            row = cursor.execute(
                "SELECT status FROM companion_sessions WHERE session_guid = ?",
                (session_guid,),
            ).fetchone()
            return row is not None and row["status"] == status
    except Exception as e:
        logger.error(f"companion: import claim failed: {e}")
        raise


def claim_received(session_guid: str) -> bool:
    """Move a held ('received') session into processing for batch import.
    False when it was not waiting."""
    try:
        with get_db().transaction() as cursor:
            cursor.execute(
                "UPDATE companion_sessions SET status = 'processing'"
                " WHERE session_guid = ? AND status = 'received'",
                (session_guid,),
            )
            return cursor.rowcount > 0
    except Exception as e:
        logger.error(f"companion: received claim failed: {e}")
        return False


def list_sessions(limit: int = 100) -> list[dict[str, Any]]:
    """Recent sessions, newest first, with the imported encounter's date."""
    try:
        with get_db().read() as cursor:
            cursor.execute(
                """
                SELECT s.session_guid, s.status, s.error, s.imported_at,
                       s.received_at, s.device_id, s.patient_display_name,
                       s.patient_ur_number, s.started_at, s.ended_at,
                       s.utterance_count, s.encounter_id, e.encounter_date
                FROM companion_sessions s
                LEFT JOIN encounters e ON e.id = s.encounter_id
                ORDER BY s.received_at DESC, s.session_guid DESC
                LIMIT ?
                """,
                (limit,),
            )
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        logger.error(f"companion: session list failed: {e}")
        return []


def get_document(session_guid: str) -> dict[str, Any] | None:
    """The stored raw document for a session, if any."""
    row = get_import(session_guid)
    if not row or not row.get("document"):
        return None
    try:
        return json.loads(row["document"])
    except (TypeError, ValueError) as e:
        logger.error(f"companion: stored document unreadable for {session_guid}: {e}")
        return None


def delete_session(session_guid: str) -> bool:
    """Dismiss a session row. False while an import is processing."""
    try:
        with get_db().transaction() as cursor:
            cursor.execute(
                "DELETE FROM companion_sessions WHERE session_guid = ? AND status != 'processing'",
                (session_guid,),
            )
            return cursor.rowcount > 0
    except Exception as e:
        logger.error(f"companion: session delete failed: {e}")
        return False


def finish_import(session_guid: str, encounter_id: int) -> None:
    try:
        with get_db().transaction() as cursor:
            cursor.execute(
                "UPDATE companion_sessions SET status = 'imported', encounter_id = ?,"
                " imported_at = ?, error = NULL, document = NULL WHERE session_guid = ?",
                (encounter_id, datetime.now().isoformat(), session_guid),
            )
    except Exception as e:
        logger.error(f"companion: import finish failed: {e}")
        raise


def fail_import(session_guid: str, error: str) -> None:
    try:
        with get_db().transaction() as cursor:
            cursor.execute(
                "UPDATE companion_sessions SET status = 'failed', error = ? WHERE session_guid = ?",
                (error[:2000], session_guid),
            )
    except Exception as e:
        logger.error(f"companion: import failure record failed: {e}")


def reset_failed_import(session_guid: str) -> bool:
    """Re-claim a failed import for retry. False when it was not failed."""
    try:
        with get_db().transaction() as cursor:
            cursor.execute(
                "UPDATE companion_sessions SET status = 'processing', error = NULL"
                " WHERE session_guid = ? AND status = 'failed'",
                (session_guid,),
            )
            return cursor.rowcount > 0
    except Exception as e:
        logger.error(f"companion: import reset failed: {e}")
        return False
