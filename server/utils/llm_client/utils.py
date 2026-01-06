"""Utility functions for LLM client operations."""

import json
import logging
import platform
import re

logger = logging.getLogger(__name__)

CODE_FENCE_RE = re.compile(
    r"""(?isx)
    ```[ \t]*(?:json|application/json)?[^\n]*\n
    (?P<body>.*?)
    \n```[ \t]*\r?\n?
    """,
)


def _escape_control_chars_in_json_strings(json_str: str) -> str:
    """Escape control characters inside JSON string values.

    This handles cases where LLMs return JSON with literal newlines, tabs,
    or other control characters inside string values instead of their escaped forms.
    """
    result = []
    i = 0
    while i < len(json_str):
        if json_str[i] == '"':
            # Found start of string - find the end
            j = i + 1
            while j < len(json_str):
                if json_str[j] == "\\" and j + 1 < len(json_str):
                    # Skip escaped character (e.g., \", \\, \n)
                    j += 2
                elif json_str[j] == '"':
                    # Found end of string - process the content
                    string_content = json_str[i + 1 : j]
                    # Escape backslashes first (to avoid double-escaping)
                    escaped = string_content.replace("\\", "\\\\")
                    # Then escape control characters
                    escaped = escaped.replace("\n", "\\n")
                    escaped = escaped.replace("\r", "\\r")
                    escaped = escaped.replace("\t", "\\t")
                    result.append(f'"{escaped}"')
                    i = j
                    break
                else:
                    j += 1
            else:
                # Unclosed string, just append the rest as-is
                result.append(json_str[i:])
                break
        else:
            result.append(json_str[i])
        i += 1
    return "".join(result)


def repair_json(json_str: str) -> str:
    """Attempt to repair malformed JSON string."""
    if not json_str:
        logger.info("Empty JSON response, returning empty string")
        return ""

    json_str = json_str.strip()

    # Early repair: escape control characters in JSON string values
    # This must be done before any parsing attempts
    original = json_str
    json_str = _escape_control_chars_in_json_strings(json_str)
    if json_str != original:
        logger.info("Escaped control characters in JSON string values")

    # Try parsing as is
    try:
        json.loads(json_str)
        logger.info(f"Successfully parsed JSON without repair")
        return json_str
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON response, attempting to repair...")
        pass

    # Remove <think> tags and their contents
    if "<think" in json_str.lower():
        logger.info("Removing <think> tags")
        json_str = re.sub(
            r"<think\b[^>]*>.*?</think>",
            "",
            json_str,
            flags=re.IGNORECASE | re.DOTALL,
        )
        json_str = json_str.strip()

        try:
            json.loads(json_str)
            logger.info(f"Successfully parsed JSON response")
            return json_str
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON response, attempting further repair...")
            pass

    # Remove markdown code blocks
    m = CODE_FENCE_RE.search(json_str)
    if m:
        logger.info("Extracting JSON from markdown code fence")
        json_str = m.group("body").strip()

        try:
            json.loads(json_str)
            logger.info(f"Successfully parsed JSON response")
            return json_str
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON response, attempting further repair...")
            pass

    # Fix both: {{ ... }} -> { ... }
    if re.match(r"^\s*\{\s*\{", json_str) and re.search(
        r"\}\s*\}\s*$", json_str
    ):
        logger.info("Fixing double open and close braces")
        temp = re.sub(r"^\s*\{", "", json_str, count=1)
        temp = re.sub(r"\}\s*$", "", temp, count=1)
        try:
            json.loads(temp)
            return temp
        except json.JSONDecodeError:
            logger.info("Failed")
            pass

    # Fix double open braces: { { ... } -> { ... }
    if re.match(r"^\s*\{\s*\{", json_str):
        logger.info("Fixing double open braces")
        # Try removing the first {
        temp = re.sub(r"^\s*\{", "", json_str, count=1)
        try:
            json.loads(temp)
            return temp
        except json.JSONDecodeError:
            logger.info("Failed")
            pass

    # Fix double close braces: { ... } } -> { ... }
    if re.search(r"\}\s*\}\s*$", json_str):
        logger.info("Fixing double close braces")
        # Try removing the last }
        temp = re.sub(r"\}\s*$", "", json_str, count=1)
        try:
            json.loads(temp)
            return temp
        except json.JSONDecodeError:
            logger.info("Failed")
            pass

    # Fix unquoted bullet-pointed items in arrays (LLM sometimes outputs these)
    # Handles: - item, + item, * item, • item -> "item"
    # This must run before the quoted bullet fix since it adds quotes
    if re.search(r'[-+*•]\s*[^"\[\],}', json_str):
        logger.info("Fixing unquoted bullet-pointed array items")
        # Match bullet followed by non-JSON content until comma, newline, or ]
        # The pattern captures text that doesn't start with a quote
        json_str = re.sub(
            r'[-+*•]\s*([^,\[\]"\n]+?)(?=,|\n|\s*\])', r'"\1"', json_str
        )
        try:
            json.loads(json_str)
            logger.info(f"Successfully parsed JSON response")
            return json_str
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON response, attempting further repair...")
            pass

    # Fix bullet-like prefixes before strings in arrays (LLM sometimes outputs these)
    # Handles: - "item", + "item", * "item", • "item" -> "item"
    if re.search(r'[-+*•]\s*"', json_str):
        logger.info("Removing bullet-like prefixes from array items")
        json_str = re.sub(r'[-+*•]\s*"([^"]*)"', r'"\1"', json_str)
        try:
            json.loads(json_str)
            logger.info(f"Successfully parsed JSON response")
            return json_str
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON response, attempting further repair...")
            pass

    # All repair attempts failed - log the original response
    logger.error(f"Failed to repair JSON. Original response:\n{json_str}")
    return json_str


def is_arm_mac() -> bool:
    """Check if we're running on an ARM Mac."""
    return platform.system() == "Darwin" and platform.machine() == "arm64"
