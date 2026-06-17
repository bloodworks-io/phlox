"""Database testing utilities for Phlox.

This module provides utilities for testing database functionality.
"""

import json
import logging
from datetime import datetime


def run_database_test(cursor, db):
    """Test database functionality with sample data.

    Args:
        cursor: Database cursor
        db: Database connection

    Returns:
        True if test successful
    """
    try:
        # Test template
        template_data = {
            "field_key": "test_template",
            "template_name": "Test Template",
            "fields": [
                {
                    "field_key": "presenting_complaint",
                    "field_name": "Presenting Complaint",
                    "field_type": "text",
                    "persistent": True,
                }
            ],
        }

        # Insert test template
        cursor.execute(
            """
            INSERT INTO clinical_templates (template_key, template_name, fields)
            VALUES (?, ?, ?)
        """,
            ("test_template", "Test Template", json.dumps(template_data)),
        )

        template_patient_data = {"presenting_complaint": "Test complaint"}

        cursor.execute(
            """
            INSERT INTO encounters (
                ur_number, encounter_date,
                template_key, template_data, raw_transcription,
                transcription_duration, process_duration
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            (
                "UR12345",
                datetime.now().isoformat(),
                "test_template",
                json.dumps(template_patient_data),
                "Test transcription",
                1.0,
                1.0,
            ),
        )

        cursor.execute(
            """
            INSERT INTO patient_profiles (ur_number, first_name, last_name, dob, gender)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(ur_number) DO UPDATE SET
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                dob = excluded.dob,
                gender = excluded.gender
            """,
            ("UR12345", "Test", "User", "2000-01-01", "M"),
        )

        db.commit()
        return True
    except Exception as e:
        logging.error(f"Database test failed: {str(e)}")
        db.rollback()
        raise


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
