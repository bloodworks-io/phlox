"""Migration v2: Add reasoning analysis support."""

import json

from server.database.config.defaults.prompts import DEFAULT_PROMPTS


def migrate(cursor, _db):
    """Add reasoning_output column, index, config, prompt, and options."""
    cursor.execute(
        """
        ALTER TABLE patients
        ADD COLUMN reasoning_output JSON
        """
    )

    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_reasoning_date
        ON patients(encounter_date, reasoning_output)
        """
    )

    cursor.execute(
        """
        INSERT OR IGNORE INTO config (key, value)
        VALUES
            ('REASONING_MODEL', ?),
            ('REASONING_ENABLED', ?)
    """,
        (json.dumps(""), json.dumps(False)),
    )

    defaults = DEFAULT_PROMPTS

    reasoning_prompt = defaults["prompts"]["reasoning"]["system"]
    cursor.execute(
        """
        INSERT OR IGNORE INTO prompts (key, system)
        VALUES (?, ?)
    """,
        ("reasoning", reasoning_prompt),
    )

    reasoning_options = defaults["options"]["reasoning"]
    for key, value in reasoning_options.items():
        cursor.execute(
            """
            INSERT OR IGNORE INTO options (category, key, value)
            VALUES (?, ?, ?)
        """,
            ("reasoning", key, str(value)),
        )
