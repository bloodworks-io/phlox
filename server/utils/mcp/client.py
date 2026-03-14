"""MCP (Model Context Protocol) client wrapper.

This module provides a client for connecting to MCP servers via Streamable HTTP transport.
"""

import asyncio
import logging
from contextlib import AsyncExitStack
from typing import Any

from mcp import ClientSession
from mcp.client.sse import sse_client

logger = logging.getLogger(__name__)

# Global cache for MCP tools (synchronous access)
_mcp_tools_cache: list[dict[str, Any]] = []


class McpServerClient:
    """Client for a single MCP server using Streamable HTTP transport."""

    def __init__(self, server_config: dict[str, Any]) -> None:
        """Initialize the MCP server client.

        Args:
            server_config: Server configuration from mcp_manager
        """
        self.server_config = server_config
        self.session: ClientSession | None = None
        self.exit_stack = AsyncExitStack()
        self._tools_cache: list[dict[str, Any]] | None = None

    async def connect(self) -> bool:
        """Connect to the MCP server via Streamable HTTP.

        Returns:
            True if connection successful, False otherwise
        """
        try:
            url = self.server_config.get("url")
            if not url:
                logger.error(
                    f"No URL configured for MCP server '{self.server_config['name']}'"
                )
                return False

            sse_transport = await self.exit_stack.enter_async_context(
                sse_client(url)
            )

            self.session = await self.exit_stack.enter_async_context(
                ClientSession(sse_transport[0], sse_transport[1])
            )

            await self.session.initialize()

            logger.info(
                f"Connected to MCP server '{self.server_config['name']}' via Streamable HTTP"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to connect to MCP server '{self.server_config['name']}': {e}"
            )
            return False

    async def disconnect(self) -> None:
        """Disconnect from the MCP server."""
        try:
            await self.exit_stack.aclose()
            self.session = None
            self._tools_cache = None
            logger.info(f"Disconnected from MCP server '{self.server_config['name']}'")
        except Exception as e:
            logger.error(f"Error disconnecting from MCP server: {e}")

    async def list_tools(self) -> list[dict[str, Any]]:
        """List available tools from the MCP server.

        Returns:
            List of tool definitions
        """
        if not self.session:
            await self.connect()

        if not self.session:
            return []

        try:
            response = await self.session.list_tools()
            tools = []

            for tool in response.tools:
                # Convert to OpenAI function format
                tools.append(
                    {
                        "type": "function",
                        "function": {
                            "name": f"mcp_{self._sanitize_name(self.server_config['name'])}_{tool.name}",
                            "description": tool.description,
                            "parameters": tool.inputSchema,
                        },
                        "_mcp_server_id": self.server_config["id"],
                        "_mcp_tool_name": tool.name,
                    }
                )

            self._tools_cache = tools
            return tools

        except Exception as e:
            logger.error(f"Error listing tools from MCP server: {e}")
            return []

    async def call_tool(
        self, tool_name: str, arguments: dict[str, Any]
    ) -> Any:
        """Call a tool on the MCP server.

        Args:
            tool_name: Name of the tool to call (without the mcp_ prefix)
            arguments: Arguments to pass to the tool

        Returns:
            The tool's response
        """
        if not self.session:
            await self.connect()

        if not self.session:
            raise RuntimeError("Not connected to MCP server")

        try:
            response = await self.session.call_tool(tool_name, arguments)
            return response
        except Exception as e:
            logger.error(f"Error calling tool '{tool_name}' on MCP server: {e}")
            raise

    def _sanitize_name(self, name: str) -> str:
        """Sanitize a server name for use in tool names."""
        return name.lower().replace("-", "_").replace(" ", "_").replace("/", "_")


async def get_mcp_tools() -> list[dict[str, Any]]:
    """Get all available tools from enabled MCP servers.

    Returns:
        List of tool definitions from all enabled MCP servers
    """
    from server.database.config.mcp_manager import mcp_config_manager

    tools = []
    servers = mcp_config_manager.get_enabled_servers()

    for server_config in servers:
        client = McpServerClient(server_config)
        try:
            server_tools = await client.list_tools()
            tools.extend(server_tools)
        except Exception as e:
            logger.error(
                f"Failed to get tools from MCP server '{server_config['name']}': {e}"
            )
        finally:
            await client.disconnect()

    # Update the global cache
    global _mcp_tools_cache
    _mcp_tools_cache = tools

    return tools


def get_mcp_tools_sync() -> list[dict[str, Any]]:
    """Get MCP tools from the synchronous cache.

    Returns:
        List of cached tool definitions
    """
    return _mcp_tools_cache.copy()


async def refresh_mcp_tools_cache() -> None:
    """Refresh the global MCP tools cache."""
    await get_mcp_tools()


async def call_mcp_tool(
    server_id: int, tool_name: str, arguments: dict[str, Any]
) -> Any:
    """Call a tool on a specific MCP server.

    Args:
        server_id: ID of the MCP server
        tool_name: Name of the tool to call (without namespace prefix)
        arguments: Arguments to pass to the tool

    Returns:
        The tool's response
    """
    from server.database.config.mcp_manager import mcp_config_manager

    server_config = mcp_config_manager.get_server(server_id)
    if not server_config:
        raise ValueError(f"MCP server {server_id} not found")

    client = McpServerClient(server_config)
    try:
        if not await client.connect():
            raise RuntimeError(f"Failed to connect to MCP server {server_id}")

        return await client.call_tool(tool_name, arguments)
    finally:
        await client.disconnect()
