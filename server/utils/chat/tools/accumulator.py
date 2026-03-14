"""
Tool result accumulator for collecting streaming output.

This module provides a way to consume streaming tool execution
and accumulate the results for non-streaming contexts.
"""

import logging
from collections.abc import AsyncGenerator
from typing import Any

logger = logging.getLogger(__name__)


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
        self.citations: list[str] | None = None
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
                        if "content" in self.function_response:
                            if not self.content:
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


async def collect_tool_result(
    stream: AsyncGenerator[dict[str, Any], None]
) -> tuple[str, list[str] | None]:
    """Convenience function to collect streaming result.

    Args:
        stream: Async generator yielding streaming message chunks

    Returns:
        Tuple of (content_string, citations_list)
    """
    accumulator = ToolResultAccumulator()
    return await accumulator.consume_stream(stream)
