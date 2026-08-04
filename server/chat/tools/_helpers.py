"""Shared helpers for chat tool ``execute`` entrypoints."""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def parse_tool_args(tool_call: dict[str, Any]) -> dict[str, Any]:
    """Parse the ``arguments`` payload of a tool call into a dict.

    Returns the parsed dict, or ``{}`` when the payload is missing or not
    valid JSON. The tool name is included in the failure log so the source
    of a malformed call is identifiable (the prior per-tool log did not name
    the function).
    """
    raw = tool_call.get("function", {}).get("arguments")
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            function_name = tool_call.get("function", {}).get("name", "<unknown>")
            logger.error(f"Failed to parse function arguments JSON for {function_name}")
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}
