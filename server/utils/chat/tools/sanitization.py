"""Shared sanitization utilities for tool queries.

This module provides sanitization functions to clean queries before sending
to external services, removing potential PHI and other problematic content.
"""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def sanitize_query_for_external_search(
    query: str, patient_context: dict[str, Any] | None = None
) -> str:
    """Remove potential PHI from search queries before sending to external services.

    This is a defense-in-depth measure to prevent accidental PHI leakage even if
    the LLM includes it in search queries despite prompt instructions.

    Args:
        query: The original search query
        patient_context: Optional dict with patient info to specifically remove
            (ur_number, name, etc.)

    Returns:
        Sanitized query string with PHI patterns removed
    """
    sanitized = query

    # Remove common PHI patterns
    # UR numbers (various formats)
    sanitized = re.sub(r"\bUR\s*[:#]?\s*\d{4,}\b", "", sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(
        r"\bUR\s*[:#]?\s*[A-Z]?\d{4,}[A-Z]?\b", "", sanitized, flags=re.IGNORECASE
    )

    # Medical record numbers
    sanitized = re.sub(r"\bMRN\s*[:#]?\s*\d+\b", "", sanitized, flags=re.IGNORECASE)

    # Dates of birth (various formats)
    sanitized = re.sub(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", "", sanitized)
    sanitized = re.sub(r"\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b", "", sanitized)

    # Phone numbers
    sanitized = re.sub(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", "", sanitized)
    sanitized = re.sub(
        r"\b\+?\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4}\b", "", sanitized
    )

    # Email addresses
    sanitized = re.sub(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "", sanitized
    )

    # Addresses (simple pattern for street addresses)
    sanitized = re.sub(
        r"\b\d+\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b",
        "",
        sanitized,
        flags=re.IGNORECASE,
    )

    # Medicare/health card numbers (Australian format)
    sanitized = re.sub(r"\b\d{4}\s?\d{4,5}\s?\d{1,2}\b", "", sanitized)

    # Remove specific patient context if provided
    if patient_context:
        if patient_context.get("ur_number"):
            sanitized = sanitized.replace(patient_context["ur_number"], "")
        if patient_context.get("name"):
            # Remove each part of the name
            for name_part in patient_context["name"].split():
                sanitized = re.sub(
                    rf"\b{re.escape(name_part)}\b", "", sanitized, flags=re.IGNORECASE
                )

    # Clean up extra whitespace and punctuation
    sanitized = re.sub(r"\s+", " ", sanitized)
    sanitized = re.sub(r"^[\s,-]+|[\s,-]+$", "", sanitized)

    if sanitized != query:
        logger.info(f"Sanitized search query: '{query}' -> '{sanitized}'")

    return sanitized.strip() or query  # Return original if sanitization empties it


def sanitize_pubmed_query(query: str) -> str:
    """Sanitize query by removing standalone years that PubMed interprets as keywords.

    PubMed E-utilities treats bare years (e.g., "2024") as required keyword search terms,
    not date filters. This removes standalone years while preserving years that are part
    of disease names (e.g., "COVID-19").

    Args:
        query: The raw search query

    Returns:
        Sanitized query with standalone years removed
    """

    sanitized = re.sub(r"(?<!\S)(20[0-2][0-9]|19[8-9][0-9])(?!\S)", "", query)

    # Clean up extra whitespace that may result from removal
    sanitized = re.sub(r"\s+", " ", sanitized).strip()

    return sanitized
