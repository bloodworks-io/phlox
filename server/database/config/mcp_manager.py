"""MCP (Model Context Protocol) server configuration manager.

This module manages MCP server configurations stored in the database.
"""

import logging
from threading import Lock
from typing import Any

import sqlcipher3 as sqlite3

from server.database.core.connection import get_db, is_db_initialized

logger = logging.getLogger(__name__)


class McpConfigManager:
    """Manages MCP server configurations."""

    _instance = None
    _lock = Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance.db = get_db()
                cls._instance._load_configs()
            return cls._instance

    def refresh_db(self):
        """Refresh database reference if connection is closed."""
        if not is_db_initialized():
            return

        try:
            self.db.cursor.execute("SELECT 1")
        except (sqlite3.ProgrammingError, sqlite3.OperationalError):
            self.db = get_db()

    def _load_configs(self):
        """Load MCP server configurations from the database."""
        self.refresh_db()
        self.servers = []

        try:
            self.db.cursor.execute(
                """
                SELECT id, name, url, description, server_version, enabled, allow_sensitive_data, created_at, updated_at
                FROM mcp_servers
                ORDER BY created_at DESC
                """
            )
            for row in self.db.cursor.fetchall():
                self.servers.append({
                    "id": row["id"],
                    "name": row["name"],
                    "url": row["url"],
                    "description": row["description"] or "",
                    "server_version": row["server_version"] or "",
                    "enabled": bool(row["enabled"]),
                    "allow_sensitive_data": bool(row["allow_sensitive_data"]),
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                })
        except sqlite3.OperationalError:
            # Table doesn't exist yet, will be created by migration
            logger.warning("mcp_servers table does not exist yet")

    def get_servers(self) -> list[dict[str, Any]]:
        """Return all configured MCP servers."""
        return self.servers.copy()

    def get_enabled_servers(self) -> list[dict[str, Any]]:
        """Return only enabled MCP servers."""
        return [s for s in self.servers if s.get("enabled", True)]

    def get_server(self, server_id: int) -> dict[str, Any] | None:
        """Get a specific server by ID."""
        for server in self.servers:
            if server["id"] == server_id:
                return server.copy()
        return None

    def add_server(
        self,
        name: str,
        url: str,
        allow_sensitive_data: bool = False,
        description: str = "",
        server_version: str = "",
    ) -> dict[str, Any]:
        """Add a new MCP server configuration.

        Args:
            name: Human-readable name for the server
            url: URL for the MCP server endpoint (e.g., http://localhost:3000/mcp)
            allow_sensitive_data: Whether to allow PHI in tool arguments (default: False)
            description: Optional description of the server
            server_version: Version string from the server's initialize response

        Returns:
            The created server configuration

        Raises:
            ValueError: If validation fails
        """
        if not url:
            raise ValueError("url is required")

        self.refresh_db()

        self.db.cursor.execute(
            """
            INSERT INTO mcp_servers (name, url, description, server_version, allow_sensitive_data)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, url, description, server_version, 1 if allow_sensitive_data else 0),
        )
        # Capture lastrowid before commit (it may be reset after commit)
        new_id = self.db.cursor.lastrowid
        self.db.commit()

        # Reload configs
        self._load_configs()

        # Return the newly created server
        return self.get_server(new_id)

    def update_server(
        self,
        server_id: int,
        name: str | None = None,
        url: str | None = None,
        allow_sensitive_data: bool | None = None,
        description: str | None = None,
        server_version: str | None = None,
    ) -> dict[str, Any] | None:
        """Update an existing MCP server configuration.

        Returns:
            The updated server configuration, or None if not found
        """
        server = self.get_server(server_id)
        if not server:
            return None

        updates = []
        params = []

        if name is not None:
            updates.append("name = ?")
            params.append(name)

        if url is not None:
            updates.append("url = ?")
            params.append(url)

        if allow_sensitive_data is not None:
            updates.append("allow_sensitive_data = ?")
            params.append(1 if allow_sensitive_data else 0)

        if description is not None:
            updates.append("description = ?")
            params.append(description)

        if server_version is not None:
            updates.append("server_version = ?")
            params.append(server_version)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(server_id)

            self.refresh_db()
            self.db.cursor.execute(
                f"UPDATE mcp_servers SET {', '.join(updates)} WHERE id = ?",
                params,
            )
            self.db.commit()

            # Reload configs
            self._load_configs()

        return self.get_server(server_id)

    def remove_server(self, server_id: int) -> bool:
        """Remove an MCP server configuration.

        Returns:
            True if the server was removed, False if not found
        """
        server = self.get_server(server_id)
        if not server:
            return False

        self.refresh_db()
        self.db.cursor.execute("DELETE FROM mcp_servers WHERE id = ?", (server_id,))
        self.db.commit()

        # Reload configs
        self._load_configs()

        return True

    def toggle_server(self, server_id: int, enabled: bool) -> bool:
        """Enable or disable an MCP server.

        Returns:
            True if the server was updated, False if not found
        """
        server = self.get_server(server_id)
        if not server:
            return False

        self.refresh_db()
        self.db.cursor.execute(
            "UPDATE mcp_servers SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (1 if enabled else 0, server_id),
        )
        self.db.commit()

        # Reload configs
        self._load_configs()

        return True


mcp_config_manager = McpConfigManager()
