"""
Deduplication module for removing duplicate content across medical transcription fields.

This module provides a post-processing step that identifies and removes duplicate
or misplaced items across multiple fields using LLM tool calls.
"""

import json
import logging
import re
from typing import Dict, List, Optional

from server.database.config.manager import config_manager
from server.schemas.templates import TemplateField
from server.utils.llm_client.client import get_llm_client

logger = logging.getLogger(__name__)


async def deduplicate_field_contents(
    fields: Dict[str, str], template_fields: List[TemplateField]
) -> Dict[str, str]:
    """
    Remove duplicate or misplaced items across fields using LLM tool calls.

    Args:
        fields: Dictionary mapping field_key to refined content
        template_fields: List of TemplateField objects containing field definitions

    Returns:
        Dictionary with deduplicated field contents
    """
    if not fields:
        return fields

    # Filter template_fields to only include fields present in the results
    present_fields = {
        f.field_key: f for f in template_fields if f.field_key in fields
    }

    if len(present_fields) < 2:
        logger.info("Less than 2 fields present, skipping deduplication")
        return fields

    logger.info(f"Running deduplication for {len(present_fields)} fields")

    try:
        config = config_manager.get_config()
        client = get_llm_client()
        prompts = config_manager.get_prompts_and_options()
        options = prompts["options"]["general"].copy()
        options.pop("stop", None)  # Remove stop tokens for tool calls

        model_name = config.get("PRIMARY_MODEL")

        # Build field definitions for the prompt
        field_definitions = _build_field_definitions(present_fields)

        # Build the content display
        content_display = _build_content_display(fields, present_fields)

        system_prompt = """You are a medical note editor. Your task is to review the extracted fields and identify:

1. Duplicate content appearing in multiple fields
2. Items that belong in a different field than where they currently appear

FIELD DEFINITIONS (use these to determine correct placement):
Each field has a system_prompt that describes what content belongs there.
- If an item matches field A's description but appears in field B, move it from B to A
- If an item appears in multiple fields, keep it only in the field whose system_prompt best describes it
- Prefer action items, follow-ups, and orders in the "plan" field if present
- Prefer clinical findings, symptoms, and exam findings in history/exam fields
- Remove exact duplicates (same content in multiple fields)

Use tools to remove duplicates or move items to their correct field.
Make multiple tool_calls if needed - each removes or moves one item."""

        user_prompt = f"""Review the following extracted medical note fields for duplicates and misplacements:

{field_definitions}

EXTRACTED CONTENT:
{content_display}

Identify duplicates and items in the wrong field. Use tools to:
- remove_item(field_key, item_text): Remove a duplicate or misplaced item
- move_item(from_field, to_field, item_text): Move an item to the correct field
- keep_unchanged(): No changes needed

Note: When specifying item_text, use the EXACT text from the content above, including the bullet/number prefix if present."""

        tools = _get_deduplication_tools(list(present_fields.keys()))

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response = await client.chat(
            model=model_name,
            messages=messages,
            tools=tools,
            options=options,
        )

        # Process tool calls
        deduplicated = await _process_deduplication_tool_calls(
            response,
            fields,
            list(present_fields.keys()),
            client,
            model_name,
            options,
        )

        logger.info("Deduplication completed")
        return deduplicated

    except Exception as e:
        logger.error(f"Error during deduplication: {e}", exc_info=True)
        # Return original fields on error
        return fields


def _build_field_definitions(present_fields: Dict[str, TemplateField]) -> str:
    """Build a formatted string of field definitions for the prompt."""
    lines = []
    for field_key, field in present_fields.items():
        # Extract a concise description from system_prompt
        prompt_preview = (
            field.system_prompt.split(".")[0] if field.system_prompt else ""
        )
        lines.append(f"- {field_key} ({field.field_name}): {prompt_preview}")
    return "\n".join(lines)


def _build_content_display(
    fields: Dict[str, str], present_fields: Dict[str, TemplateField]
) -> str:
    """Build a formatted display of field contents."""
    lines = []
    for field_key, field in present_fields.items():
        content = fields.get(field_key, "")
        lines.append(f"\n{field_key} ({field.field_name}):")
        lines.append(f"{content or '(empty)'}")
    return "\n".join(lines)


def _get_deduplication_tools(field_keys: List[str]) -> List[dict]:
    """Define tools for field deduplication."""
    return [
        {
            "type": "function",
            "function": {
                "name": "remove_item",
                "description": "Remove a duplicate or misplaced item from a field",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "field_key": {
                            "type": "string",
                            "description": f"Field key to remove from. One of: {', '.join(field_keys)}",
                            "enum": field_keys,
                        },
                        "item_text": {
                            "type": "string",
                            "description": "Exact text of the item to remove (including bullet/number prefix if present)",
                        },
                    },
                    "required": ["field_key", "item_text"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "move_item",
                "description": "Move an item from one field to another where it belongs",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "from_field": {
                            "type": "string",
                            "description": f"Source field key. One of: {', '.join(field_keys)}",
                            "enum": field_keys,
                        },
                        "to_field": {
                            "type": "string",
                            "description": f"Destination field key. One of: {', '.join(field_keys)}",
                            "enum": field_keys,
                        },
                        "item_text": {
                            "type": "string",
                            "description": "Exact text of the item to move (including bullet/number prefix if present)",
                        },
                    },
                    "required": ["from_field", "to_field", "item_text"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "keep_unchanged",
                "description": "No duplicates or misplacements found - keep all fields as-is",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
    ]


async def _process_deduplication_tool_calls(
    response,
    fields: Dict[str, str],
    field_keys: List[str],
    client,
    model_name: str,
    options: dict,
) -> Dict[str, str]:
    """Process tool calls from the deduplication LLM response."""
    from server.utils.llm_client import LLMProviderType

    config = config_manager.get_config()

    if (
        config.get("LLM_PROVIDER", "ollama").lower()
        == LLMProviderType.OPENAI_COMPATIBLE.value
    ):
        tool_calls = response["message"].get("tool_calls")
    else:
        tool_calls = response.get("tool_calls")

    if not tool_calls:
        logger.info("No tool calls - keeping fields unchanged")
        return fields

    logger.info(f"Processing {len(tool_calls)} deduplication tool calls")

    # Work with a copy of fields
    result = {k: v for k, v in fields.items()}

    for tool_call in tool_calls:
        function_name = tool_call["function"]["name"]

        # Parse arguments
        try:
            if isinstance(tool_call["function"]["arguments"], str):
                function_arguments = json.loads(
                    tool_call["function"]["arguments"]
                )
            else:
                function_arguments = tool_call["function"]["arguments"]
        except json.JSONDecodeError:
            logger.error(
                f"Failed to parse function arguments JSON for {function_name}"
            )
            continue

        logger.info(
            f"Processing tool call: {function_name} with args: {function_arguments}"
        )

        if function_name == "remove_item":
            field_key = function_arguments.get("field_key")
            item_text = function_arguments.get("item_text")

            if field_key in result:
                result[field_key] = _remove_item_from_content(
                    result[field_key], item_text
                )
                logger.info(f"Removed item from {field_key}")

        elif function_name == "move_item":
            from_field = function_arguments.get("from_field")
            to_field = function_arguments.get("to_field")
            item_text = function_arguments.get("item_text")

            if from_field in result and to_field in result:
                # Remove from source
                result[from_field] = _remove_item_from_content(
                    result[from_field], item_text
                )
                # Add to destination (formatting appropriately)
                result[to_field] = _add_item_to_content(
                    result[to_field], item_text, to_field
                )
                logger.info(f"Moved item from {from_field} to {to_field}")

        elif function_name == "keep_unchanged":
            logger.info("LLM chose to keep fields unchanged")
            return fields

    return result


def _remove_item_from_content(content: str, item_text: str) -> str:
    """Remove an item from field content, handling various bullet/number formats."""
    if not content:
        return content

    lines = content.split("\n")
    filtered_lines = []

    # Normalize the item_text for comparison
    item_normalized = _normalize_item_text(item_text)

    for line in lines:
        line_normalized = _normalize_item_text(line)
        if line_normalized != item_normalized:
            filtered_lines.append(line)

    result = "\n".join(filtered_lines).strip()

    # Clean up extra whitespace from removed items
    result = re.sub(r"\n{3,}", "\n\n", result)

    return result


def _add_item_to_content(content: str, item_text: str, field_key: str) -> str:
    """Add an item to field content, maintaining consistent formatting."""
    # Strip the prefix from the item_text to get the core text
    core_text = re.sub(r"^[\d\.\-\•\*\s]+", "", item_text).strip()

    # Determine the appropriate prefix based on existing content
    if content:
        first_line = content.split("\n")[0]
        if re.match(r"^\d+\.", first_line.strip()):
            # Numbered list - find next number
            numbered_items = re.findall(r"^(\d+)\.", content, re.MULTILINE)
            next_num = (
                max(int(n) for n in numbered_items) + 1 if numbered_items else 1
            )
            prefix = f"{next_num}. "
        else:
            # Bullet or other
            bullet_match = re.match(r"^([\-\•\*])\s", first_line.strip())
            prefix = f"{bullet_match.group(1)} " if bullet_match else "- "
        return f"{content}\n{prefix}{core_text}"
    else:
        # Empty content, start with a bullet
        return f"- {core_text}"


def _normalize_item_text(text: str) -> str:
    """Normalize item text for comparison, removing prefixes and extra whitespace."""
    # Remove common list prefixes
    text = re.sub(r"^[\d\.\-\•\*\s]+", "", text.strip())
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)
    # Lowercase for comparison
    return text.lower().strip()
