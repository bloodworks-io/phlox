"""
Direct response tool implementation.

This tool handles non-medical queries like greetings, chat, and clarifications.
"""

import logging
from collections.abc import AsyncGenerator
from typing import Any

from server.utils.chat.streaming.response import (
    status_message,
    stream_llm_response,
)

logger = logging.getLogger(__name__)


async def execute(
    tool_call: dict[str, Any],
    llm_client,
    config: dict[str, Any],
    message_list: list,
    context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """
    Execute the direct response tool.

    Args:
        tool_call: The tool call to execute.
        llm_client: The LLM client instance.
        config: The configuration dictionary.
        message_list: The current message list.
        context_question_options: The context question options.

    Yields:
        Dict[str, Any]: Streaming response chunks.
    """
    logger.info("Executing direct response...")

    if llm_client is None:
        logger.warning("direct_response called without LLM client")
        yield status_message("Generating response...")

        from server.utils.chat.streaming.response import tool_response_message

        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content="This tool is only available in chat context. Please rephrase your request.",
            )
        )
        return

    # Remove the assistant's tool call message from history since direct_response
    # doesn't use tools - the tool call was just for routing, not for LLM context
    if message_list and message_list[-1].get("role") == "assistant":
        message_list.pop()

    yield status_message("Generating response...")

    async for chunk in stream_llm_response(
        llm_client=llm_client,
        model=config["PRIMARY_MODEL"],
        messages=message_list,
        options=context_question_options,
    ):
        yield chunk
