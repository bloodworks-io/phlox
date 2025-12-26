"""Utility functions for LLM client operations."""

import json
import logging
import platform
import re

logger = logging.getLogger(__name__)


def repair_json(json_str: str) -> str:
    """Attempt to repair malformed JSON string."""
    if not json_str:
        logger.info("Empty JSON response, returning empty string")
        return ""

    json_str = json_str.strip()

    # Remove <think> tags and their contents
    if "<think" in json_str.lower():
        json_str = re.sub(
            r"<think\b[^>]*>.*?</think>",
            "",
            json_str,
            flags=re.IGNORECASE | re.DOTALL,
        )
        json_str = json_str.strip()

    # Remove markdown code blocks
    if "```" in json_str:
        json_str = re.sub(r"^```(?:json)?\s*", "", json_str)
        json_str = re.sub(r"\s*```$", "", json_str)
        json_str = json_str.strip()

    # Try parsing as is
    try:
        json.loads(json_str)
        logger.info(f"Successfully parsed JSON response")
        return json_str
    except json.JSONDecodeError:
        logging.error(f"Invalid JSON response, attempting to repair...")
        pass

    # Fix double open braces: { { ... } -> { ... }
    if re.match(r"^\s*\{\s*\{", json_str):
        # Try removing the first {
        temp = re.sub(r"^\s*\{", "", json_str, count=1)
        try:
            json.loads(temp)
            return temp
        except json.JSONDecodeError:
            pass

    # Fix double close braces: { ... } } -> { ... }
    if re.search(r"\}\s*\}\s*$", json_str):
        # Try removing the last }
        temp = re.sub(r"\}\s*$", "", json_str, count=1)
        try:
            json.loads(temp)
            return temp
        except json.JSONDecodeError:
            pass

    # Fix both: {{ ... }} -> { ... }
    if re.match(r"^\s*\{\s*\{", json_str) and re.search(
        r"\}\s*\}\s*$", json_str
    ):
        temp = re.sub(r"^\s*\{", "", json_str, count=1)
        temp = re.sub(r"\}\s*$", "", temp, count=1)
        try:
            json.loads(temp)
            return temp
        except json.JSONDecodeError:
            pass

    return json_str


def is_arm_mac() -> bool:
    """Check if we're running on an ARM Mac."""
    return platform.system() == "Darwin" and platform.machine() == "arm64"
