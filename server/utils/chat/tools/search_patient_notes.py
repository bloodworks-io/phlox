"""
Search patient notes tool implementation.

This tool searches through a patient's historical notes and encounters
for specific terms using fuzzy matching.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from rapidfuzz import fuzz

from server.database.core.connection import get_db
from server.utils.chat.streaming.response import (
    end_message,
    status_message,
)

logger = logging.getLogger(__name__)

SEARCH_PATIENT_NOTES_TOOL_NAME = "search_patient_notes"

# Fields to search within each patient record
SEARCH_FIELDS = [
    "raw_transcription",
    "encounter_summary",
    "final_letter",
]

# Fields within template_data JSON to search
TEMPLATE_DATA_FIELDS = [
    "primary_history",
    "clinical_history",
    "secondary_history",
    "investigations",
    "impression",
    "plan",
    "adaptive_refinement_instructions",
]

# Fuzzy match threshold (0-100)
FUZZY_THRESHOLD = 70


def extract_text_from_record(record: dict) -> dict[str, str]:
    """Extract all searchable text from a patient record.

    Args:
        record: Patient record dict from database

    Returns:
        Dict mapping field names to their text content
    """
    texts = {}

    # Extract direct text fields
    for field in SEARCH_FIELDS:
        if record.get(field):
            texts[field] = str(record[field])

    # Extract template_data JSON fields
    if record.get("template_data"):
        try:
            template_data = (
                json.loads(record["template_data"])
                if isinstance(record["template_data"], str)
                else record["template_data"]
            )
            if isinstance(template_data, dict):
                for field in TEMPLATE_DATA_FIELDS:
                    if template_data.get(field):
                        texts[f"template_data.{field}"] = str(template_data[field])
        except json.JSONDecodeError:
            pass

    return texts


def find_matches_in_text(text: str, search_term: str, threshold: int = FUZZY_THRESHOLD) -> list[dict]:
    """Find fuzzy matches for search term in text.

    Args:
        text: The text to search
        search_term: The term to search for
        threshold: Minimum fuzzy match score (0-100)

    Returns:
        List of match dicts with score and context
    """
    matches = []
    text_lower = text.lower()
    search_lower = search_term.lower()

    # Split text into sentences/segments for better context
    segments = text.replace("\n", " ").split(". ")

    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue

        # Check for fuzzy match
        score = fuzz.partial_ratio(search_lower, segment.lower())
        if score >= threshold:
            # Truncate long segments for context
            context = segment[:300] + "..." if len(segment) > 300 else segment
            matches.append({"score": score, "context": context})

    return matches


async def search_patient_notes(
    ur_number: str | None = None,
    patient_name: str | None = None,
    search_term: str | None = None,
) -> dict:
    """Search a patient's notes for a specific term.

    Args:
        ur_number: Patient's UR number
        patient_name: Patient's name (if UR not known)
        search_term: The term to search for

    Returns:
        Dict with search results
    """
    if not search_term:
        return {"success": False, "error": "search_term is required"}

    if not ur_number and not patient_name:
        return {"success": False, "error": "Either ur_number or patient_name is required"}

    try:
        # Build query to get all encounters for this patient
        if ur_number:
            get_db().cursor.execute(
                """
                SELECT id, name, ur_number, dob, encounter_date,
                       template_data, raw_transcription, encounter_summary, final_letter
                FROM patients
                WHERE ur_number = ?
                ORDER BY encounter_date DESC
                """,
                (ur_number,),
            )
        else:
            get_db().cursor.execute(
                """
                SELECT id, name, ur_number, dob, encounter_date,
                       template_data, raw_transcription, encounter_summary, final_letter
                FROM patients
                WHERE LOWER(name) LIKE LOWER(?)
                ORDER BY encounter_date DESC
                """,
                (f"%{patient_name}%",),
            )

        rows = get_db().cursor.fetchall()

        if not rows:
            return {
                "success": False,
                "error": f"No patient found with {'UR: ' + ur_number if ur_number else 'name: ' + patient_name}"
            }

        # Search through all encounters
        results = []
        patient_info = None

        for row in rows:
            record = dict(row)

            # Store patient info from first (most recent) record
            if patient_info is None:
                patient_info = {
                    "name": record["name"],
                    "ur_number": record["ur_number"],
                    "dob": record["dob"],
                }

            # Extract all text from this record
            texts = extract_text_from_record(record)

            # Search for matches in each field
            encounter_matches = []
            for field_name, text in texts.items():
                matches = find_matches_in_text(text, search_term)
                for match in matches:
                    encounter_matches.append({
                        "field": field_name,
                        "score": match["score"],
                        "context": match["context"],
                    })

            # Sort matches by score
            encounter_matches.sort(key=lambda x: x["score"], reverse=True)

            if encounter_matches:
                results.append({
                    "encounter_date": record["encounter_date"],
                    "patient_id": record["id"],
                    "matches": encounter_matches[:5],  # Top 5 matches per encounter
                    "match_count": len(encounter_matches),
                })

        if not results:
            return {
                "success": True,
                "patient": patient_info,
                "search_term": search_term,
                "results": [],
                "message": f"No matches found for '{search_term}' in patient's notes.",
            }

        return {
            "success": True,
            "patient": patient_info,
            "search_term": search_term,
            "results": results,
            "total_encounters_with_matches": len(results),
        }

    except Exception as e:
        logger.error(f"Error searching patient notes: {e}")
        return {"success": False, "error": str(e)}


def format_search_response(result: dict) -> str:
    """Format the search result as a readable string.

    Args:
        result: The result dict from search_patient_notes

    Returns:
        Formatted string for display
    """
    if not result.get("success"):
        return f"Error: {result.get('error', 'Unknown error')}"

    patient = result.get("patient", {})
    search_term = result.get("search_term", "")
    results = result.get("results", [])

    parts = [
        f"Patient: {patient.get('name', 'Unknown')}",
        f"UR Number: {patient.get('ur_number', 'N/A')}",
        f"Search term: '{search_term}'",
        "",
    ]

    if not results:
        parts.append(result.get("message", "No matches found."))
        return "\n".join(parts)

    parts.append(f"Found matches in {len(results)} encounter(s):\n")

    for encounter in results:
        parts.append(f"** Encounter: {encounter['encounter_date']} **")
        for match in encounter["matches"]:
            field_display = match["field"].replace("_", " ").title()
            parts.append(f"  [{field_display}] (score: {match['score']})")
            parts.append(f"    \"{match['context']}\"")
        parts.append("")

    return "\n".join(parts)


async def execute(
    tool_call: dict[str, Any],
    llm_client,
    config: dict[str, Any],
    message_list: list,
    context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute the search_patient_notes tool.

    Args:
        tool_call: The tool call to execute
        llm_client: The LLM client instance
        config: The configuration dictionary
        message_list: The current message list
        context_question_options: The context question options

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    logger.info("Executing search_patient_notes tool...")
    yield status_message("Searching patient notes...")

    # Parse function arguments
    function_arguments = {}
    if "arguments" in tool_call["function"]:
        try:
            if isinstance(tool_call["function"]["arguments"], str):
                function_arguments = json.loads(tool_call["function"]["arguments"])
            else:
                function_arguments = tool_call["function"]["arguments"]
        except json.JSONDecodeError:
            logger.error("Failed to parse function arguments JSON")

    ur_number = function_arguments.get("ur_number")
    patient_name = function_arguments.get("patient_name")
    search_term = function_arguments.get("search_term")

    result_content: str = ""
    citations: list[str] = []

    if not search_term:
        result_content = "Error: Please provide a search term to look for in the patient's notes."
    elif not ur_number and not patient_name:
        result_content = "Error: Please provide either a UR number or patient name to search."
    else:
        try:
            result = await search_patient_notes(
                ur_number=ur_number,
                patient_name=patient_name,
                search_term=search_term,
            )

            result_content = format_search_response(result)

            if result.get("success") and result.get("results"):
                patient = result.get("patient", {})
                citations.append(f"Notes search for {patient.get('name', 'patient')}")

        except Exception as e:
            logger.error(f"Search patient notes error: {e}")
            result_content = f"Error searching patient notes: {str(e)}"

    yield end_message(function_response={"content": result_content, "citations": citations})
