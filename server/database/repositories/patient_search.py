import json
import logging
from typing import Any

from rapidfuzz import fuzz
from server.database.core.connection import get_db
from server.database.repositories.templates import (
    get_persistent_fields,
    get_template_by_key,
)
from server.utils.helpers import format_name


def get_unique_primary_conditions():
    """
    Retrieve all unique primary conditions from the encounters table.

    Returns:
        list: A list of unique primary condition strings, excluding None values.
    """
    try:
        with get_db().read() as cursor:
            cursor.execute("""
                SELECT DISTINCT primary_condition
                FROM encounters
                WHERE primary_condition IS NOT NULL
                AND primary_condition != ''
                ORDER BY primary_condition ASC
                """)
            results = cursor.fetchall()
            return [row["primary_condition"] for row in results]
    except Exception as e:
        logging.error(f"Error getting unique primary conditions: {e}")
        return []


def _encounter_row_to_candidate(row) -> dict[str, Any] | None:
    """Build a search-candidate dict from a joined patient_profiles + encounters row"""
    template_key = row["template_key"]
    if not get_template_by_key(template_key):
        return None

    persistent_fields = get_persistent_fields(template_key)
    template_data = json.loads(row["template_data"]) if row["template_data"] else {}
    persistent_data = {
        field.field_key: template_data.get(field.field_key) for field in persistent_fields
    }

    first_name = row["first_name"]
    last_name = row["last_name"]

    return {
        "id": row["id"],
        "name": format_name(first_name, last_name),
        "gender": row["gender"],
        "dob": row["dob"],
        "ur_number": row["ur_number"],
        "first_name": first_name,
        "last_name": last_name,
        "address": row["address"],
        "phone": row["phone"],
        "encounter_date": row["encounter_date"],
        "template_key": template_key,
        "template_data": persistent_data,
    }


def search_patients(query: str) -> list[dict[str, Any]]:
    """
    Search patients by UR number (exact) OR name (substring match on
    first_name / last_name).
    """
    if not query:
        return []
    like = f"%{query}%"
    try:
        with get_db().read() as cursor:
            cursor.execute(
                """
                SELECT p.ur_number, p.first_name, p.last_name, p.dob, p.gender,
                       p.address, p.phone,
                       e.id, e.encounter_date, e.template_key, e.template_data
                FROM patient_profiles p
                JOIN encounters e ON e.id = (
                    SELECT id FROM encounters
                    WHERE ur_number = p.ur_number
                    ORDER BY encounter_date DESC, id DESC
                    LIMIT 1
                )
                WHERE p.ur_number = ?
                   OR p.first_name LIKE ?
                   OR p.last_name LIKE ?
                ORDER BY (p.last_name LIKE ?) DESC, p.last_name, p.first_name
                LIMIT 20
                """,
                (query, like, like, like),
            )
            rows = cursor.fetchall()

        # Rows materialised; release the lock before template lookups / parsing.
        candidates = []
        for row in rows:
            candidate = _encounter_row_to_candidate(row)
            if candidate is not None:
                candidates.append(candidate)
        return candidates
    except Exception as e:
        logging.error(f"Error searching patients: {e}")
        raise


def search_patient_by_ur_number(ur_number: str) -> list[dict[str, Any]]:
    """
    Search for patients by UR number, delegates to
    search_patients.
    """
    return search_patients(ur_number)


def search_patients_by_condition(query: str, limit: int = 20) -> list[dict[str, Any]]:
    """
    Find patients whose primary condition fuzzy-matches ``query``.
    """
    if not query or not query.strip():
        return []
    query = query.strip()

    distinct = get_unique_primary_conditions()
    if not distinct:
        return []

    q_lower = query.lower()
    matched: list[str] = [c for c in distinct if fuzz.token_set_ratio(q_lower, c.lower()) >= 70]
    # Fallback: if fuzzy missed everything, try a plain LIKE substring pass.
    if not matched:
        matched = [c for c in distinct if query.lower() in c.lower()]
    if not matched:
        return []

    placeholders = ",".join("?" for _ in matched)
    try:
        with get_db().read() as cursor:
            cursor.execute(
                f"SELECT p.ur_number, p.first_name, p.last_name, p.dob, p.gender, "
                f"e.primary_condition, e.encounter_date, e.encounter_summary, "
                f"e.template_key, cnt.encounter_count "
                f"FROM patient_profiles p "
                f"JOIN encounters e ON e.id = ("
                f"    SELECT id FROM encounters"
                f"    WHERE ur_number = p.ur_number"
                f"      AND primary_condition IS NOT NULL"
                f"    ORDER BY encounter_date DESC, id DESC"
                f"    LIMIT 1"
                f") "
                f"JOIN ("
                f"    SELECT ur_number, COUNT(*) AS encounter_count"
                f"    FROM encounters"
                f"    WHERE primary_condition IS NOT NULL"
                f"    GROUP BY ur_number"
                f") cnt ON cnt.ur_number = p.ur_number "
                f"WHERE e.primary_condition IN ({placeholders}) "  # nosec B608
                f"ORDER BY p.last_name, p.first_name "
                f"LIMIT ?",
                (*matched, limit),
            )
            rows = cursor.fetchall()

        patients = []
        for row in rows:
            first_name = row["first_name"]
            last_name = row["last_name"]
            patients.append(
                {
                    "ur_number": row["ur_number"],
                    "name": format_name(first_name, last_name),
                    "dob": row["dob"],
                    "gender": row["gender"],
                    "primary_condition": row["primary_condition"],
                    "last_encounter_date": row["encounter_date"],
                    "encounter_summary": row["encounter_summary"],
                    "encounter_count": row["encounter_count"],
                }
            )
        return patients
    except Exception as e:
        logging.error(f"Error searching patients by condition: {e}")
        raise
