"""Utility functions for LLM client operations."""

import logging
import platform
import re

from json_repair import repair_json as library_repair_json

logger = logging.getLogger(__name__)


def repair_json(json_str: str) -> str:
    """Repair malformed JSON using json-repair library with LLM-specific preprocessing.

        This wrapper handles LLM-specific issues like ``

    `` tags before delegating
        to the json_repair library for general JSON repair.
    """
    if not json_str:
        return ""

    json_str = json_str.strip()

    # Remove </think> tags (LLM reasoning/thinking blocks)
    if "<think" in json_str.lower():
        logger.info("Removing </think> tags from LLM response")
        json_str = re.sub(
            r"<think\b[^>]*>.*?</think>",
            "",
            json_str,
            flags=re.IGNORECASE | re.DOTALL,
        )
        json_str = json_str.strip()

    return library_repair_json(json_str)


def is_arm_mac() -> bool:
    """Check if we're running on an ARM Mac."""
    return platform.system() == "Darwin" and platform.machine() == "arm64"
