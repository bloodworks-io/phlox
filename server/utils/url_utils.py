"""URL normalization utilities for OpenAI/Whisper-compatible endpoints.

These helpers allow users to provide either:
- a host base URL (e.g. "http://localhost:11434"), or
- a URL that already includes "/v1" (e.g. "http://localhost:11434/v1")

The helpers normalize both forms so downstream code can build stable endpoint URLs
without accidentally producing "/v1/v1/...".
"""

from __future__ import annotations

from urllib.parse import urlsplit, urlunsplit


def _normalize_base_url(raw_url: str) -> str:
    """Trim whitespace and trailing slash from a URL-like string."""
    cleaned = (raw_url or "").strip()
    if not cleaned:
        raise ValueError("URL cannot be empty")
    return cleaned.rstrip("/")


def _strip_terminal_v1_path(url: str) -> str:
    """Remove a final '/v1' path segment if present.

    Examples:
    - http://a:1/v1 -> http://a:1
    - http://a:1/api/openai/v1 -> http://a:1/api/openai
    - http://a:1/api -> unchanged
    """
    parts = urlsplit(url)
    path = parts.path.rstrip("/")

    if path.lower().endswith("/v1"):
        path = path[:-3]  # remove terminal '/v1'

    return urlunsplit((parts.scheme, parts.netloc, path, "", ""))


def normalize_openai_base_url(raw_url: str) -> str:
    """Normalize an OpenAI-compatible base URL.

    Accepts URLs with or without a terminal '/v1' and returns a canonical
    base without '/v1' and without trailing slash.
    """
    normalized = _normalize_base_url(raw_url)
    normalized = _strip_terminal_v1_path(normalized)
    return normalized.rstrip("/")


def normalize_whisper_base_url(raw_url: str) -> str:
    """Normalize a Whisper-compatible base URL.

    Behavior mirrors `normalize_openai_base_url`:
    - trims whitespace
    - strips trailing slash
    - strips optional terminal '/v1'
    """
    normalized = _normalize_base_url(raw_url)
    normalized = _strip_terminal_v1_path(normalized)
    return normalized.rstrip("/")


def build_openai_v1_url(base_url: str, endpoint_path: str) -> str:
    """Build a '/v1/...'-style URL for OpenAI-compatible endpoints.

    Example:
    - base_url='http://localhost:11434' and endpoint_path='models'
      -> 'http://localhost:11434/v1/models'
    """
    base = normalize_openai_base_url(base_url)
    suffix = endpoint_path.lstrip("/")
    return f"{base}/v1/{suffix}"


def build_whisper_v1_url(base_url: str, endpoint_path: str) -> str:
    """Build a '/v1/...'-style URL for Whisper-compatible endpoints.

    Example:
    - base_url='http://localhost:8000/v1' and endpoint_path='audio/transcriptions'
      -> 'http://localhost:8000/v1/audio/transcriptions'
    """
    base = normalize_whisper_base_url(base_url)
    suffix = endpoint_path.lstrip("/")
    return f"{base}/v1/{suffix}"
