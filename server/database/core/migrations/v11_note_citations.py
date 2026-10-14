"""Migration v11: Add note citation storage."""

import logging


def migrate(cursor, _db):
    """Add nullable note_citations JSON column to encounters."""
    cursor.execute(
        """
        ALTER TABLE encounters
        ADD COLUMN note_citations JSON
        """
    )
    logging.info("Added encounters.note_citations")
