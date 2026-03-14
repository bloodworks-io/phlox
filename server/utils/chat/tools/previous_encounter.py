"""
Previous encounter tool implementation.

This tool retrieves the most recent encounter for a patient.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from server.database.core.connection import get_db
from server.utils.chat.streaming.response import (
    end_message,
    status_message,
    stream_llm_response,
    tool_response_message,
)

logger = logging.getLogger(__name__)

PREVIOUS_ENCOUNTER_TOOL_NAME = "get_previous_encounter"


async def get_previous_encounter(
    ur_number: str, current_encounter_date: str | None = None
) -> dict | None:
    """Get the most recent previous encounter for a patient (full note).

    Args:
        ur_number: The patient's UR number
        current_encounter_date: Exclude encounters from this date (current encounter date)

    Returns:
        The most recent encounter dict or None if not found
    """
    try:
        # Fetch full patient record, filtering out same-date encounters
        if current_encounter_date:
            get_db().cursor.execute(
                """
                SELECT id, encounter_date, template_key, template_data, encounter_summary
                FROM patients
                WHERE ur_number = ? AND encounter_date < ?
                ORDER BY encounter_date DESC
                LIMIT 1
                """,
                (ur_number, current_encounter_date),
            )
        else:
            get_db().cursor.execute(
                """
                SELECT id, encounter_date, template_key, template_data, encounter_summary
                FROM patients
                WHERE ur_number = ?
                ORDER BY encounter_date DESC
                LIMIT 1
                """,
                (ur_number,),
            )
        row = get_db().cursor.fetchone()
        if row:
            return dict(row)
        return None
    except Exception as e:
        logger.error(f"Error fetching previous encounter: {e}")
        return None


def format_encounter_note(encounter: dict) -> str:
    """Format encounter data as a readable clinical note.

    Args:
        encounter: The encounter dict with template_data

    Returns:
        Formatted note as string
    """
    parts = [
        f"Previous Encounter Date: {encounter.get('encounter_date', 'Unknown')}",
        "",
    ]

    template_data = encounter.get("template_data")
    if template_data:
        if isinstance(template_data, str):
            template_data = json.loads(template_data)

        # Format like the clinical note - section headers with content
        for section_name, content in template_data.items():
            if content:
                section_title = section_name.replace("_", " ").title()
                parts.append(f"{section_title}:")
                parts.append(str(content))
                parts.append("")  # Blank line between sections

    # Add encounter summary if available
    summary = encounter.get("encounter_summary")
    if summary:
        parts.append("Encounter Summary:")
        parts.append(summary)

    return "\n".join(parts)


async def execute(
    tool_call: dict[str, Any],
    llm_client,
    config: dict[str, Any],
    message_list: list,
    context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute the previous encounter tool.

    Args:
        tool_call: The tool call to execute
        llm_client: The LLM client instance
        config: The configuration dictionary
        message_list: The current message list
        context_question_options: The context question options

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    logger.info("Executing get_previous_encounter tool...")
    yield status_message("Retrieving previous encounter...")

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

    ur_number = function_arguments.get("ur_number", "")
    current_encounter_date = function_arguments.get("current_encounter_date")

    # Track citations for the function response
    citations: list[str] = []
    result_content: str = ""

    if not ur_number:
        logger.info("No UR number provided for previous encounter search")
        result_content = "Error: No UR number provided. Please specify the patient's UR number."
        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )
    else:
        try:
            logger.info(f"Fetching previous encounter for UR number: '{ur_number}', excluding date: {current_encounter_date}")
            encounter = await get_previous_encounter(ur_number, current_encounter_date)

            if not encounter:
                result_content = f"No previous encounters found for UR number: '{ur_number}'"
                logger.info("No previous encounters found")
            else:
                # Format the full encounter note
                result_content = "Found previous encounter:\n\n" + format_encounter_note(encounter)
                encounter_date = encounter.get("encounter_date", "unknown date")
                logger.info(f"Retrieved previous encounter from {encounter_date}")

                # Build citation string
                citation = f"Previous Encounter from {encounter_date}"
                citations.append(citation)

            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )
        except Exception as e:
            logger.error(f"Previous encounter error: {e}")
            result_content = f"Error retrieving previous encounter: {str(e)}"
            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )

    if llm_client is not None:
        yield status_message("Generating response with previous encounter data...")
        async for chunk in stream_llm_response(
            llm_client=llm_client,
            model=config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
        ):
            yield chunk

    yield end_message(function_response={"content": result_content, "citations": citations})
