"""Migration v8: Add preferred_language column to user_settings."""


def migrate(cursor, _db):
    """Add preferred_language column for UI and output language localization.
    """
    cursor.execute("ALTER TABLE user_settings ADD COLUMN preferred_language TEXT DEFAULT 'en'")
