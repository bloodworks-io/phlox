"""Migration v8: preferred_language column + clinic-policy key relocation."""

import json


def migrate(cursor, _db):
    """Add preferred_language column and backfill policy keys into config KV."""
    # Idempotent ALTER
    cursor.execute("PRAGMA table_info(user_settings)")
    existing = {row["name"] for row in cursor.fetchall()}
    if "preferred_language" not in existing:
        cursor.execute("ALTER TABLE user_settings ADD COLUMN preferred_language TEXT DEFAULT 'en'")

    cursor.execute("SELECT disabled_tools, advanced_options FROM user_settings LIMIT 1")
    row = cursor.fetchone()

    disabled_tools = ["pubmed_search", "wiki_search"]
    advanced = {}
    if row:
        if row["disabled_tools"]:
            disabled_tools = json.loads(row["disabled_tools"])
        if row["advanced_options"]:
            advanced = json.loads(row["advanced_options"])

    cursor.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
        ("DISABLED_TOOLS", json.dumps(disabled_tools)),
    )
    cursor.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
        ("STORE_ORIGINAL_PDFS", json.dumps(bool(advanced.get("store_original_pdfs", False)))),
    )
    cursor.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
        (
            "REQUIRE_SCRIBE_CONSENT",
            json.dumps(bool(advanced.get("require_scribe_consent", False))),
        ),
    )
