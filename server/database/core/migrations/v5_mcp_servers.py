"""Migration v5: MCP servers table, disabled_tools, provider normalization, drop unused tables."""

import json


def migrate(cursor, _db):
    """Add mcp_servers table, disabled_tools column, normalize provider, drop RSS/analysis tables."""
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS mcp_servers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            description TEXT DEFAULT '',
            server_version TEXT DEFAULT '',
            enabled BOOLEAN DEFAULT 1,
            allow_sensitive_data BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    cursor.execute(
        'ALTER TABLE user_settings ADD COLUMN disabled_tools JSON DEFAULT \'["pubmed_search", "wiki_search"]\'',
    )

    cursor.execute(
        "ALTER TABLE user_settings ADD COLUMN advanced_options JSON DEFAULT '{}'",
    )

    # Normalize legacy provider value
    cursor.execute("SELECT value FROM config WHERE key = 'LLM_PROVIDER'")
    row = cursor.fetchone()

    if row is None:
        cursor.execute(
            "INSERT INTO config (key, value) VALUES (?, ?)",
            ("LLM_PROVIDER", json.dumps("openai")),
        )
    else:
        provider_value = json.loads(row["value"])
        if isinstance(provider_value, str) and provider_value.lower() == "ollama":
            cursor.execute(
                "UPDATE config SET value = ? WHERE key = 'LLM_PROVIDER'",
                (json.dumps("openai"),),
            )

    # Seed document/image processing defaults
    cursor.execute(
        "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)",
        ("DOCUMENT_IMAGE_PROCESSING_MODE", json.dumps("auto")),
    )
    cursor.execute(
        "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)",
        ("VISION_CAPABILITY_CACHE", json.dumps({})),
    )

    # Drop unused tables
    cursor.execute("DROP TABLE IF EXISTS rss_feeds")
    cursor.execute("DROP TABLE IF EXISTS rss_items")
    cursor.execute("DROP TABLE IF EXISTS combined_digests")
    cursor.execute("DROP TABLE IF EXISTS daily_analysis")
