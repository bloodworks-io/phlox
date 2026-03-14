"""
MCP (Model Context Protocol) tool execution handler.

This module handles execution of tools from MCP servers.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from server.utils.chat.streaming.response import (
    end_message,
    status_message,
    stream_llm_response,
    tool_response_message,
)
from server.utils.chat.tools.sanitization import sanitize_query_for_external_search
from server.utils.mcp.client import call_mcp_tool

logger = logging.getLogger(__name__)


def _sanitize_arguments(args: Any, allow_sensitive: bool) -> Any:
    """Recursively sanitize string values in arguments to remove PHI.

    Args:
        args: The arguments to sanitize (can be dict, list, str, or other)
        allow_sensitive: If True, return args unchanged

    Returns:
        Sanitized arguments with PHI patterns removed from strings
    """
    if allow_sensitive:
        return args

    if isinstance(args, str):
        return sanitize_query_for_external_search(args)
    elif isinstance(args, dict):
        return {k: _sanitize_arguments(v, allow_sensitive) for k, v in args.items()}
    elif isinstance(args, list):
        return [_sanitize_arguments(item, allow_sensitive) for item in args]
    else:
        return args


async def execute(
    tool_call: dict[str, Any],
    llm_client,
    config: dict[str, Any],
    message_list: list,
    context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute an MCP tool call.

    Args:
        tool_call: The tool call to execute
        llm_client: The LLM client instance
        config: The configuration dictionary
        message_list: The current message list
        context_question_options: The context question options

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    function_name = tool_call["function"]["name"]

    # Track citations and content for the function response
    citations: list[str] = []
    result_content: str = ""

    # Format: mcp_{sanitized_server_name}_{tool_name}
    if not function_name.startswith("mcp_"):
        logger.error(f"Invalid MCP tool name: {function_name}")
        result_content = f"Invalid MCP tool name format: {function_name}"
        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )
        yield status_message("Generating response...")
        async for chunk in stream_llm_response(
            llm_client=llm_client,
            model=config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
        ):
            yield chunk
        yield end_message(function_response={"content": result_content, "citations": citations})
        return

    from server.utils.mcp.client import get_mcp_tools_sync

    mcp_tools = get_mcp_tools_sync()
    tool_def = None
    for tool in mcp_tools:
        if tool.get("function", {}).get("name") == function_name:
            tool_def = tool
            break

    if not tool_def:
        logger.error(f"MCP tool not found: {function_name}")
        result_content = f"MCP tool not found: {function_name}"
        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )
        yield status_message("Generating response...")
        async for chunk in stream_llm_response(
            llm_client=llm_client,
            model=config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
        ):
            yield chunk
        yield end_message(function_response={"content": result_content, "citations": citations})
        return

    server_id = tool_def.get("_mcp_server_id")
    original_tool_name = tool_def.get("_mcp_tool_name")

    if not server_id or not original_tool_name:
        logger.error(f"MCP tool missing metadata: {function_name}")
        result_content = f"MCP tool configuration error: {function_name}"
        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )
        yield status_message("Generating response...")
        async for chunk in stream_llm_response(
            llm_client=llm_client,
            model=config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
        ):
            yield chunk
        yield end_message(function_response={"content": result_content, "citations": citations})
        return

    function_arguments = {}
    if "arguments" in tool_call["function"]:
        try:
            if isinstance(tool_call["function"]["arguments"], str):
                function_arguments = json.loads(tool_call["function"]["arguments"])
            else:
                function_arguments = tool_call["function"]["arguments"]
        except json.JSONDecodeError:
            logger.error("Failed to parse function arguments JSON")

    # Get server config to check allow_sensitive_data flag
    from server.database.config.mcp_manager import mcp_config_manager

    server_config = mcp_config_manager.get_server(server_id)
    allow_sensitive = server_config.get("allow_sensitive_data", False) if server_config else False

    # Sanitize arguments if sensitive data is not allowed
    sanitized_arguments = _sanitize_arguments(function_arguments, allow_sensitive)

    if sanitized_arguments != function_arguments:
        logger.info(f"Sanitized MCP tool arguments for server {server_id}")

    logger.info(
        f"Executing MCP tool '{original_tool_name}' on server {server_id} "
        f"(allow_sensitive_data={allow_sensitive})"
    )
    yield status_message(f"Calling {original_tool_name}...")

    try:
        response = await call_mcp_tool(server_id, original_tool_name, sanitized_arguments)

        if hasattr(response, "content"):
            # MCP CallToolResponse has a content attribute
            content_parts = []
            for content_item in response.content:
                if hasattr(content_item, "text"):
                    content_parts.append(content_item.text)
                elif hasattr(content_item, "data"):
                    # Base64 or other data
                    content_parts.append(f"[Binary data: {content_item.type}]")
                else:
                    content_parts.append(str(content_item))
            tool_result = "\n".join(content_parts)
        else:
            tool_result = str(response)

        logger.info(f"MCP tool result: {tool_result[:200]}...")

        result_content = f"The following information was retrieved from the MCP server:\n\n{tool_result}"

        # Build citation string for MCP tool
        citation = f"MCP Tool ({original_tool_name}): {tool_result[:200]}..."
        citations.append(citation)

        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )

    except Exception as e:
        logger.error(f"Error executing MCP tool: {e}")
        result_content = f"Error calling MCP tool: {str(e)}"
        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )

    if llm_client is not None:
        yield status_message("Generating response with MCP results...")
        async for chunk in stream_llm_response(
            llm_client=llm_client,
            model=config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
        ):
            yield chunk

    yield end_message(function_response={"content": result_content, "citations": citations})
