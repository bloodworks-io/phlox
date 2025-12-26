"""
Streaming response utilities for the ChatEngine.

This module provides helper functions for generating streaming responses
with standardized formats.
"""

import logging
from typing import Any, AsyncGenerator, Dict

logger = logging.getLogger(__name__)


async def stream_llm_response(
    llm_client, model: str, messages: list, options: dict
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Stream an LLM chat response.

    Args:
        llm_client: The LLM client instance.
        model (str): The model name.
        messages (list): The messages to send.
        options (dict): Additional options for the LLM.

    Yields:
        Dict[str, Any]: Streaming response chunks.
    """
    async for chunk in await llm_client.chat(
        model=model,
        messages=messages,
        options=options,
        stream=True,
    ):
        if "message" in chunk and "content" in chunk["message"]:
            yield {
                "type": "chunk",
                "content": chunk["message"]["content"],
            }


def status_message(content: str) -> Dict[str, Any]:
    """
    Create a status message.

    Args:
        content (str): The status message content.

    Returns:
        Dict[str, Any]: A status message dictionary.
    """
    return {"type": "status", "content": content}


def chunk_message(content: str) -> Dict[str, Any]:
    """
    Create a chunk message.

    Args:
        content (str): The chunk content.

    Returns:
        Dict[str, Any]: A chunk message dictionary.
    """
    return {"type": "chunk", "content": content}


def end_message(function_response=None) -> Dict[str, Any]:
    """
    Create an end message.

    Args:
        function_response: Optional function response data.

    Returns:
        Dict[str, Any]: An end message dictionary.
    """
    return {
        "type": "end",
        "content": "",
        "function_response": function_response,
    }


def start_message() -> Dict[str, Any]:
    """
    Create a start message.

    Returns:
        Dict[str, Any]: A start message dictionary.
    """
    return {"type": "start", "content": ""}


def tool_response_message(tool_call_id: str, content: str) -> Dict[str, Any]:
    """
    Create a tool response message for the message list.

    Args:
        tool_call_id (str): The tool call ID.
        content (str): The tool response content.

    Returns:
        Dict[str, Any]: A tool response message dictionary.
    """
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": content,
    }
