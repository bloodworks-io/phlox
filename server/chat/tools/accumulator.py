"""
Tool result accumulator for collecting streaming output.

This module provides a way to consume streaming tool execution
and accumulate the results for non-streaming contexts.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

logger = logging.getLogger(__name__)


def coerce_stream_piece(value) -> str:
    """Normalize a streamed reasoning/content piece to plain text.

    Handles the piece shapes emitted by different backends: plain strings,
    lists of text fragments, and dicts carrying text/content/reasoning keys.
    """
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text_part = item.get("text") or item.get("content")
                if text_part:
                    parts.append(str(text_part))
        return "".join(parts)
    if isinstance(value, dict):
        text_part = value.get("content") or value.get("text") or value.get("reasoning")
        if text_part is not None:
            return coerce_stream_piece(text_part)
        return json.dumps(value)
    return str(value)


def _arguments_fragment(args_part: Any) -> str:
    """Normalize a streamed ``function.arguments`` piece to a string fragment.

    Backends normally stream JSON fragments as strings, but some emit the
    complete arguments object as a dict in one piece.
    """
    if args_part is None:
        return ""
    if isinstance(args_part, str):
        return args_part
    if isinstance(args_part, dict):
        return json.dumps(args_part)
    return str(args_part)


def merge_tool_call_delta(accumulated: dict[int, dict[str, Any]], tc: Any) -> None:
    """Merge a streamed tool-call delta into ``accumulated``.

    ``accumulated`` maps a per-turn index to a normalized tool-call dict
    ``{"id": str, "type": str, "function": {"name": str, "arguments": str}}``.
    Supports OpenAI-style delta objects (attribute access, indexed pieces)
    and Ollama-style dicts (either indexed pieces or one full call at the
    end of the stream).
    """
    if hasattr(tc, "index"):
        idx = tc.index
        if idx not in accumulated:
            accumulated[idx] = {
                "id": getattr(tc, "id", "") or "",
                "type": getattr(tc, "type", "function") or "function",
                "function": {"name": "", "arguments": ""},
            }
        function = getattr(tc, "function", None)
        if function is not None:
            name_part = getattr(function, "name", None)
            if name_part:
                accumulated[idx]["function"]["name"] += name_part
            args_part = getattr(function, "arguments", None)
            if args_part:
                accumulated[idx]["function"]["arguments"] += _arguments_fragment(args_part)
        tc_id = getattr(tc, "id", None)
        if tc_id:
            accumulated[idx]["id"] = tc_id
        tc_type = getattr(tc, "type", None)
        if tc_type:
            accumulated[idx]["type"] = tc_type
    elif isinstance(tc, dict):
        function_payload = tc.get("function") or {}
        idx = tc.get("index")
        if idx is None:
            # Full tool call emitted at once
            if not (tc.get("id") or function_payload.get("name")):
                return
            accumulated[len(accumulated)] = {
                "id": tc.get("id", "") or "",
                "type": tc.get("type", "function") or "function",
                "function": {
                    "name": function_payload.get("name", "") or "",
                    "arguments": _arguments_fragment(function_payload.get("arguments")),
                },
            }
            return
        if idx not in accumulated:
            accumulated[idx] = {
                "id": tc.get("id", "") or "",
                "type": tc.get("type", "function") or "function",
                "function": {"name": "", "arguments": ""},
            }
        name_part = function_payload.get("name", "")
        args_part = function_payload.get("arguments", "")
        if name_part:
            accumulated[idx]["function"]["name"] += name_part
        if args_part:
            accumulated[idx]["function"]["arguments"] += _arguments_fragment(args_part)
        if tc.get("id"):
            accumulated[idx]["id"] = tc.get("id")
        if tc.get("type"):
            accumulated[idx]["type"] = tc.get("type")


class ToolResultAccumulator:
    """Accumulates streaming tool results into a final result.

    Used by execute_tool_non_streaming() to consume streaming output
    and extract the final result and citations.

    Attributes:
        content: Accumulated content from chunk messages
        citations: List of citations from the function_response
        function_response: The raw function response from end message
        status_messages: List of status messages (for logging/debugging)
    """

    def __init__(self):
        self.content: str = ""
        self.citations: list | None = None
        self.function_response: dict[str, Any] | None = None
        self.status_messages: list[str] = []

    async def consume_stream(
        self, stream: AsyncGenerator[dict[str, Any], None]
    ) -> tuple[str, list[str] | None]:
        """Consume a streaming tool execution and return accumulated result.

        Args:
            stream: Async generator yielding streaming message chunks

        Returns:
            Tuple of (content_string, citations_list) where citations_list
            may be None if no citations were extracted
        """
        async for chunk in stream:
            chunk_type = chunk.get("type")

            if chunk_type == "status":
                status_content = chunk.get("content", "")
                if status_content:
                    self.status_messages.append(status_content)

            elif chunk_type == "chunk":
                content = chunk.get("content", "")
                if content:
                    self.content += content

            elif chunk_type == "end":
                self.function_response = chunk.get("function_response")

                if self.function_response:
                    # Handle dict-style function_response with citations
                    if isinstance(self.function_response, dict):
                        # If function_response has content field, use it
                        if "content" in self.function_response and not self.content:
                            self.content = self.function_response["content"]
                        # Extract citations if present
                        if "citations" in self.function_response:
                            self.citations = self.function_response["citations"]
                    # Handle list-style function_response (literature search)
                    elif isinstance(self.function_response, list):
                        # For backward compatibility with literature search
                        # which returns list of excerpts
                        if not self.content:
                            self.content = "\n".join(str(item) for item in self.function_response)

        logger.debug(
            f"Accumulated result: {len(self.content)} chars, "
            f"{len(self.citations) if self.citations else 0} citations"
        )

        return (self.content, self.citations)
