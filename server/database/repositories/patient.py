import logging
from datetime import datetime
from typing import Any

from server.database.core.connection import get_db


def get_patient_profile(ur_number: str | None) -> dict[str, Any] | None:
    """Fetch the per-person demographics profile keyed by ur_number."""
    if not ur_number:
        return None
    try:
        with get_db().read() as cursor:
            cursor.execute(
                """
                SELECT first_name, last_name, dob, gender, address, phone
                FROM patient_profiles WHERE ur_number = ?
                """,
                (ur_number,),
            )
            row = cursor.fetchone()
            return dict(row) if row else None
    except Exception as e:
        logging.error(f"Error fetching patient profile: {e}")
        return None


def _upsert_profile_with_cursor(cursor, profile: dict[str, Any | None]) -> None:
    """Upsert demographics on an existing cursor (for nested transactions).

    The caller owns the commit/rollback. Public callers should use
    ``upsert_patient_profile`` instead.
    """
    ur_number = profile["ur_number"]
    if not ur_number:
        return
    cursor.execute(
        """
        INSERT INTO patient_profiles
            (ur_number, first_name, last_name, dob, gender, address, phone, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ur_number) DO UPDATE SET
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            dob = excluded.dob,
            gender = excluded.gender,
            address = excluded.address,
            phone = excluded.phone,
            updated_at = excluded.updated_at
        """,
        (
            ur_number,
            profile.get("first_name"),
            profile.get("last_name"),
            profile.get("dob"),
            profile.get("gender"),
            profile.get("address"),
            profile.get("phone"),
            datetime.now().isoformat(),
        ),
    )


def upsert_patient_profile(
    ur_number: str | None,
    first_name: str | None,
    last_name: str | None,
    dob: str | None,
    gender: str | None,
    address: str | None,
    phone: str | None,
) -> None:
    """Insert or update the per-person demographics profile (source of truth)."""
    if not ur_number:
        return
    try:
        with get_db().transaction() as cursor:
            _upsert_profile_with_cursor(
                cursor,
                {
                    "ur_number": ur_number,
                    "first_name": first_name,
                    "last_name": last_name,
                    "dob": dob,
                    "gender": gender,
                    "address": address,
                    "phone": phone,
                },
            )
    except Exception as e:
        logging.error(f"Error upserting patient profile: {e}")
        raise


def get_scribe_consent(ur_number: str | None) -> dict[str, Any] | None:
    """Fetch the ambient-scribe consent state for a person (keyed by ur_number)."""
    if not ur_number:
        return None
    try:
        with get_db().read() as cursor:
            cursor.execute(
                """
                SELECT scribe_consent_at, scribe_consent_declined_at
                FROM patient_profiles WHERE ur_number = ?
                """,
                (ur_number,),
            )
            row = cursor.fetchone()
            return dict(row) if row else None
    except Exception as e:
        logging.error(f"Error fetching scribe consent: {e}")
        return None


def set_scribe_consent(ur_number: str | None, consented: bool) -> dict[str, Any] | None:
    """Record ambient-scribe consent or refusal for a person (keyed by ur_number)."""
    if not ur_number:
        return None
    now = datetime.now().isoformat()
    consented_at = now if consented else None
    declined_at = None if consented else now
    try:
        with get_db().transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO patient_profiles
                    (ur_number, scribe_consent_at, scribe_consent_declined_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(ur_number) DO UPDATE SET
                    scribe_consent_at = excluded.scribe_consent_at,
                    scribe_consent_declined_at = excluded.scribe_consent_declined_at,
                    updated_at = excluded.updated_at
                """,
                (ur_number, consented_at, declined_at, now),
            )
        return {
            "scribe_consent_at": consented_at,
            "scribe_consent_declined_at": declined_at,
        }
    except Exception as e:
        logging.error(f"Error setting scribe consent: {e}")
        raise
