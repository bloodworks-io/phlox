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


async def find_ur_by_name(
    patient_name: str, threshold: int = 70
) -> PatientMatch | None:
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
            "SELECT DISTINCT ur_number, name FROM patients WHERE ur_number IS NOT NULL AND ur_number != ''"
        )
        rows = get_db().cursor.fetchall()

        if not rows:
            logger.info("No patients found in database")
            return None

        best_match = None
        best_score = 0

        for row in rows:
            # Use token_set_ratio for better matching with partial names
            score = fuzz.token_set_ratio(patient_name.lower(), row["name"].lower())
            if score > best_score and score >= threshold:
                best_score = score
                best_match = PatientMatch(
                    ur_number=row["ur_number"], name=row["name"], score=score
                )

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


async def find_multiple_patients_by_name(
    patient_name: str, threshold: int = 70, limit: int = 5
) -> list[PatientMatch]:
    """Find multiple patients matching a name using fuzzy matching.

    Args:
        patient_name: The patient name to search for
        threshold: Minimum fuzzy match score (0-100) to accept
        limit: Maximum number of matches to return

    Returns:
        List of PatientMatch objects, sorted by score descending
    """
    try:
        get_db().cursor.execute(
            "SELECT DISTINCT ur_number, name FROM patients WHERE ur_number IS NOT NULL AND ur_number != ''"
        )
        rows = get_db().cursor.fetchall()

        if not rows:
            return []

        matches = []
        for row in rows:
            score = fuzz.token_set_ratio(patient_name.lower(), row["name"].lower())
            if score >= threshold:
                matches.append(
                    PatientMatch(ur_number=row["ur_number"], name=row["name"], score=score)
                )

        # Sort by score descending and limit
        matches.sort(key=lambda x: x.score, reverse=True)
        return matches[:limit]
    except Exception as e:
        logger.error(f"Error finding patients by name: {e}")
        return []
