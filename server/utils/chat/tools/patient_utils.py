"""
Shared patient utility functions.

These functions can be reused by multiple tools for patient lookups.
"""

import logging
from typing import NamedTuple

from rapidfuzz import fuzz

from server.database.core.connection import get_db

logger = logging.getLogger(__name__)


class PatientMatch(NamedTuple):
    """Represents a matched patient."""

    ur_number: str
    name: str
    score: int


async def find_ur_by_name(patient_name: str, threshold: int = 70) -> PatientMatch | None:
    """Find patient UR number by name using fuzzy matching.

    Args:
        patient_name: The patient name to search for
        threshold: Minimum fuzzy match score (0-100) to accept

    Returns:
        PatientMatch if found, None otherwise
    """
    try:
        # Get all patients with their names and UR numbers
        get_db().cursor.execute(
            """
            SELECT DISTINCT e.ur_number, p.first_name, p.last_name
            FROM encounters e
            LEFT JOIN patient_profiles p ON p.ur_number = e.ur_number
            WHERE e.ur_number IS NOT NULL AND e.ur_number != ''
            """
        )
        rows = get_db().cursor.fetchall()

        if not rows:
            logger.info("No patients found in database")
            return None

        best_match = None
        best_score = 0

        for row in rows:
            first = row["first_name"]
            last = row["last_name"]
            name = f"{last}, {first}" if (last and first) else (last or first or "")
            # Use token_set_ratio for better matching with partial names
            score = fuzz.token_set_ratio(patient_name.lower(), name.lower())
            if score > best_score and score >= threshold:
                best_score = score
                best_match = PatientMatch(ur_number=row["ur_number"], name=name, score=int(score))

        if best_match:
            logger.info(
                f"Fuzzy match found: '{patient_name}' -> '{best_match.name}' (UR: {best_match.ur_number}, score: {best_match.score})"
            )
            return best_match

        logger.info(
            f"No fuzzy match found for '{patient_name}' (best score: {best_score}, threshold: {threshold})"
        )
        return None
    except Exception as e:
        logger.error(f"Error finding patient by name: {e}")
        return None

