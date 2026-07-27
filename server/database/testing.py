"""Database testing utilities for Phlox.

This module provides utilities for testing database functionality.
"""

import logging


def clear_test_database(patient_db):
    """Clear all test data from database.

    Args:
        patient_db: PatientDatabase instance (only cleared when in test mode)
    """
    if not patient_db.is_test:
        return
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
        with patient_db.transaction() as cursor:
            for table in tables:
                cursor.execute(f"DELETE FROM {table}")  # nosec B608
    except Exception as e:
        logging.error(f"Failed to clear test database: {str(e)}")
        raise
