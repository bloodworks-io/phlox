"""
Direct response tool implementation.

This tool handles non-medical queries like greetings, chat, and clarifications.
"""

import logging
from typing import Any, AsyncGenerator, Dict

from server.utils.chat.streaming.response import (
    status_message,
    stream_llm_response,
)

logger = logging.getLogger(__name__)


async def execute(
    tool_call: Dict[str, Any],
    llm_client,
    config: Dict[str, Any],
    message_list: list,
    context_question_options: Dict[str, Any],
) -> AsyncGenerator[Dict[str, Any], None]:
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
    yield status_message("Generating response...")

    async for chunk in stream_llm_response(
        llm_client=llm_client,
        model=config["PRIMARY_MODEL"],
        messages=message_list,
        options=context_question_options,
    ):
        yield chunk
