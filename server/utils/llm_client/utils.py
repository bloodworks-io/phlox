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


def repair_json(json_str: str) -> str:
    """Attempt to repair malformed JSON string."""
    if not json_str:
        logger.info("Empty JSON response, returning empty string")
        return ""

    json_str = json_str.strip()

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

    return json_str


def is_arm_mac() -> bool:
    """Check if we're running on an ARM Mac."""
    return platform.system() == "Darwin" and platform.machine() == "arm64"
