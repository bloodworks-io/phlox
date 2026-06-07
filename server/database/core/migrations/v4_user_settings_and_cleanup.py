"""Migration v4: User settings columns, dictation template, and token cleanup."""

import json

from server.database.config.defaults.letters import DefaultLetters


def migrate(cursor, _db):
    """Add splash/ambient columns, dictation template, remove stop tokens, clean &nbsp;."""
    cursor.execute(
        "ALTER TABLE user_settings ADD COLUMN has_completed_splash_screen BOOLEAN DEFAULT TRUE"
    )
    cursor.execute("ALTER TABLE user_settings ADD COLUMN scribe_is_ambient BOOLEAN DEFAULT TRUE")
    cursor.execute("DELETE FROM options WHERE key = 'stop'")

    # Add Dictation template
    dictation_name, dictation_instructions = DefaultLetters.get_dictation_template()
    cursor.execute(
        """
        INSERT INTO letter_templates (name, instructions)
        SELECT ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM letter_templates WHERE name = ?)
    """,
        (dictation_name, dictation_instructions, dictation_name),
    )

    cursor.execute(
        "UPDATE letter_templates SET instructions = ? WHERE name = ?",
        (dictation_instructions, dictation_name),
    )

    # Replace &nbsp; in config
    cursor.execute("SELECT key, value FROM config")
    for row in cursor.fetchall():
        key = row["key"]
        value = json.loads(row["value"])
        if value == "&nbsp;":
            cursor.execute(
                "UPDATE config SET value = ? WHERE key = ?",
                (json.dumps(""), key),
            )

    # Replace &nbsp; in template style_example fields
    cursor.execute("SELECT template_key, fields FROM clinical_templates")
    for row in cursor.fetchall():
        template_key = row["template_key"]
        fields = json.loads(row["fields"])
        updated = False
        for field in fields:
            if field.get("style_example") == "&nbsp;":
                field["style_example"] = ""
                updated = True
        if updated:
            cursor.execute(
                "UPDATE clinical_templates SET fields = ? WHERE template_key = ?",
                (json.dumps(fields), template_key),
            )
