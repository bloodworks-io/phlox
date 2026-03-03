"""Database initialization functions for Phlox.

This module handles initialization tasks that run after migrations,
such as creating default templates and settings.
"""

import json
import logging
from datetime import datetime

from server.database.config.defaults.templates import DefaultTemplates
from server.schemas.templates import ClinicalTemplate, TemplateField


def template_exists(cursor, template_key: str) -> bool:
    """Check if a template exists.

    Args:
        cursor: Database cursor
        template_key: The template key to check

    Returns:
        True if template exists, False otherwise
    """
    cursor.execute(
        "SELECT 1 FROM clinical_templates WHERE template_key = ?",
        (template_key,),
    )
    return cursor.fetchone() is not None


def initialize_templates(cursor, db):
    """Create default templates if they don't exist, or update if they do.

    Default templates are synced on every startup to ensure users get the latest
    template improvements. Templates that have been modified by users (marked as
    deleted and superseded by a new version) are updated but stay deleted.

    Args:
        cursor: Database cursor
        db: Database connection
    """
    for template_data in DefaultTemplates.get_default_templates():
        template_key = template_data["template_key"]
        template_name = template_data["template_name"]
        fields = [TemplateField(**field) for field in template_data["fields"]]
        fields_json = json.dumps([field.dict() for field in fields])

        cursor.execute(
            "SELECT deleted, created_at FROM clinical_templates WHERE template_key = ?",
            (template_key,),
        )
        row = cursor.fetchone()

        now = datetime.now().isoformat()

        if row is None:
            # Template doesn't exist - create it
            cursor.execute(
                """
                INSERT INTO clinical_templates (template_key, template_name, fields, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (template_key, template_name, fields_json, now, now),
            )
            logging.info(f"Created default template: {template_name}")
        else:
            # Template exists - update it, preserving the deleted flag and created_at
            deleted = row["deleted"] if row["deleted"] is not None else False
            cursor.execute(
                """
                UPDATE clinical_templates
                SET template_name = ?, fields = ?, updated_at = ?
                WHERE template_key = ?
                """,
                (template_name, fields_json, now, template_key),
            )
            status = "updated" if not deleted else "updated (stays deleted)"
            logging.info(f"Default template {status}: {template_name}")


def set_initial_default_template(cursor, db):
    """Set the initial default template to the latest Phlox template.

    Args:
        cursor: Database cursor
        db: Database connection
    """
    try:
        # Get the latest non-deleted Phlox template
        cursor.execute(
            "SELECT template_key FROM clinical_templates WHERE template_key LIKE 'phlox%' AND (deleted IS NULL OR deleted != 1) ORDER BY created_at DESC LIMIT 1"
        )
        phlox_template = cursor.fetchone()

        if not phlox_template:
            logging.error("No valid Phlox template found in the database")
            return

        default_template_key = phlox_template["template_key"]

        # Check if user_settings table is empty
        cursor.execute("SELECT COUNT(*) FROM user_settings")
        count = cursor.fetchone()[0]

        if count == 0:
            # Create initial settings with default template and splash screen status False
            cursor.execute(
                "INSERT INTO user_settings (default_template_key, has_completed_splash_screen) VALUES (?, ?)",
                (default_template_key, False),
            )
            logging.info(
                f"Created initial user settings with default template: {default_template_key}"
            )
        else:
            # Get current default template
            cursor.execute("SELECT id, default_template_key FROM user_settings LIMIT 1")
            row = cursor.fetchone()
            current_default = row["default_template_key"]

            # Check if default template is not set or is invalid
            need_update = False

            if not current_default:
                need_update = True
                logging.info("No default template currently set")
            else:
                # Verify the current default template exists and is not deleted
                cursor.execute(
                    "SELECT 1 FROM clinical_templates WHERE template_key = ? AND (deleted IS NULL OR deleted != 1)",
                    (current_default,),
                )
                template_exists = cursor.fetchone() is not None

                if not template_exists:
                    need_update = True
                    logging.info(
                        f"Current default template '{current_default}' is invalid or deleted"
                    )

            if need_update:
                cursor.execute(
                    "UPDATE user_settings SET default_template_key = ? WHERE id = ?",
                    (default_template_key, row["id"]),
                )
                logging.info(f"Updated default template to: {default_template_key}")

        db.commit()
    except Exception as e:
        logging.error(f"Error setting initial default template: {e}")
        raise
