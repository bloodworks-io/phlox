"""Database testing utilities for Phlox.

This module provides utilities for testing database functionality.
"""

import logging


def clear_test_database(db, cursor, is_test):
    """Clear all test data from database.

    Args:
        db: Database connection
        cursor: Database cursor
        is_test: Whether this is a test database
    """
    if is_test:
        tables = [
            "encounters",
            "patient_profiles",
            "clinical_templates",
            "todos",
            "config",
            "prompts",
            "options",
            "schema_version",
        ]
        try:
            for table in tables:
                cursor.execute(f"DELETE FROM {table}")  # nosec B608
            db.commit()
        except Exception as e:
            logging.error(f"Failed to clear test database: {str(e)}")
            raise
