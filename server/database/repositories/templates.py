import json
import logging
from datetime import datetime
from typing import Any

from server.database.core.connection import get_db
from server.schemas.templates import (
    ClinicalTemplate,
    TemplateField,
)


def get_template_by_key(template_key: str, exact_match: bool = True) -> dict[str, Any] | None:
    """
    Retrieve a template by its key.

    Args:
        template_key: The template key to search for
        exact_match: If True, finds exact key match. If False, finds latest version of base key
    """
    try:
        with get_db().read() as cursor:
            if exact_match:
                cursor.execute(
                    """
                    SELECT template_key, template_name, fields
                    FROM clinical_templates
                    WHERE template_key = ?
                    """,
                    (template_key,),
                )
            else:
                # Get latest version of template
                base_key = template_key.split("_")[0]
                cursor.execute(
                    """
                    SELECT template_key, template_name, fields
                    FROM clinical_templates
                    WHERE template_key LIKE ? AND deleted = FALSE
                    ORDER BY template_key DESC LIMIT 1
                    """,
                    (f"{base_key}_%",),
                )

            row = cursor.fetchone()
            if row:
                return {
                    "template_key": row["template_key"],
                    "template_name": row["template_name"],
                    "fields": json.loads(row["fields"]),
                }
            return None

    except Exception as e:
        logging.error(f"Error fetching template: {e}")
        raise


def get_all_templates() -> list[dict[str, Any]]:
    """
    Retrieve all available templates.
    """
    try:
        with get_db().read() as cursor:
            cursor.execute("""
                SELECT template_key, template_name, fields
                FROM clinical_templates
                WHERE deleted = FALSE
                ORDER BY template_name
                """)
            templates = []
            for row in cursor.fetchall():
                templates.append(
                    {
                        "template_key": row["template_key"],
                        "template_name": row["template_name"],
                        "fields": json.loads(row["fields"]),
                    }
                )
            return templates
    except Exception as e:
        logging.error(f"Error fetching templates: {e}")
        raise


def get_base_key(template_key: str) -> str:
    """
    Extract the base key by removing the version number suffix.
    The version number is always the last underscore followed by digits.

    Examples:
        itp_follow-up_note-b_1 → itp_follow-up_note-b
        progress_note_2 → progress_note
        soap_01 → soap
        phlox_1 → phlox
    """
    parts = template_key.rsplit("_", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0]
    return template_key


def save_template(template: ClinicalTemplate) -> str:
    """
    Save a new clinical template.

    Args:
        template (ClinicalTemplate): The template to save.

    Returns:
        str: The template key of the saved template.

    Raises:
        ValueError: If template with same key already exists.
    """
    try:
        with get_db().transaction() as cursor:
            if template_exists(template.template_key):
                raise ValueError(f"Template with key {template.template_key} already exists")

            now = datetime.now().isoformat()
            cursor.execute(
                """
                INSERT INTO clinical_templates
                (template_key, template_name, fields, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    template.template_key,
                    template.template_name,
                    json.dumps([field.model_dump() for field in template.fields]),
                    now,
                    now,
                ),
            )
            return template.template_key
    except Exception as e:
        logging.error(f"Error saving template: {e}")
        raise


def update_template(template: ClinicalTemplate) -> str:
    """
    Update a template by creating a new version only if the content has changed.
    Returns the template key (either existing or new version).
    """
    try:
        with get_db().transaction() as cursor:
            base_key = get_base_key(template.template_key)

            # Get the current version of the template
            cursor.execute(
                """
                SELECT template_key, template_name, fields
                FROM clinical_templates
                WHERE template_key LIKE ? AND deleted = FALSE
                ORDER BY template_key DESC LIMIT 1
                """,
                (f"{base_key}_%",),
            )
            current = cursor.fetchone()

            if current:
                # Compare current and new content
                current_fields = json.loads(current["fields"])
                new_fields = [field.model_dump() for field in template.fields]

                # Copy over previous adaptive refinement instructions
                current_fields_map = {f["field_key"]: f for f in current_fields if "field_key" in f}
                for field in new_fields:
                    prev = current_fields_map.get(field.get("field_key"))
                    if (
                        prev
                        and (
                            "adaptive_refinement_instructions" not in field
                            or not field["adaptive_refinement_instructions"]
                        )
                        and prev.get("adaptive_refinement_instructions")
                    ):
                        field["adaptive_refinement_instructions"] = prev[
                            "adaptive_refinement_instructions"
                        ]
                # Only update if there are actual changes
                if (
                    current["template_name"] == template.template_name
                    and current_fields == new_fields
                ):
                    return current["template_key"]  # Return existing key if no changes

            # If we get here, there are changes, so create new version
            # Check if this template is currently the default
            cursor.execute("SELECT default_template_key FROM user_settings LIMIT 1")
            settings = cursor.fetchone()
            is_default = settings and settings["default_template_key"] == template.template_key

            # Get the latest version number
            cursor.execute(
                """
                SELECT template_key FROM clinical_templates
                WHERE template_key LIKE ?
                ORDER BY template_key DESC LIMIT 1
                """,
                (f"{base_key}_%",),
            )
            result = cursor.fetchone()

            current_version = 0
            if result:
                try:
                    current_version = int(result["template_key"].split("_")[-1])
                except ValueError:
                    current_version = 0

            # Create new version number
            new_version = current_version + 1
            new_template_key = f"{base_key}_{new_version}"

            # Mark current version as deleted
            cursor.execute(
                """
                UPDATE clinical_templates
                SET deleted = TRUE
                WHERE template_key LIKE ? AND deleted = FALSE
                """,
                (f"{base_key}_%",),
            )

            # Insert new version
            now = datetime.now().isoformat()
            cursor.execute(
                """
                INSERT INTO clinical_templates
                (template_key, template_name, fields, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    new_template_key,
                    template.template_name,
                    json.dumps([field.model_dump() for field in template.fields]),
                    now,
                    now,
                ),
            )

            # If this was the default template, update the default to the new version
            if is_default:
                cursor.execute(
                    """
                    UPDATE user_settings
                    SET default_template_key = ?
                    WHERE default_template_key = ?
                    """,
                    (new_template_key, template.template_key),
                )
                logging.info(f"Updated default template to new version: {new_template_key}")

            return new_template_key

    except Exception as e:
        logging.error(f"Error updating template: {e}")
        raise


def soft_delete_template(template_key: str) -> bool:
    """
    Soft delete a template by marking it as deleted.

    Args:
        template_key (str): The key of the template to delete.

    Returns:
        bool: True if marked as deleted successfully.
    """
    try:
        with get_db().transaction() as cursor:
            now = datetime.now().isoformat()
            cursor.execute(
                """
                UPDATE clinical_templates
                SET deleted = TRUE,
                    updated_at = ?
                WHERE template_key = ?
                """,
                (now, template_key),
            )
            return cursor.rowcount > 0
    except Exception as e:
        logging.error(f"Error soft deleting template: {e}")
        raise


def template_exists(template_key: str, include_deleted: bool = False) -> bool:
    """
    Check if a template exists.

    Args:
        template_key (str): The key of the template to check.
        include_deleted (bool): If True, includes soft-deleted templates. Default False.

    Returns:
        bool: True if the template exists.
    """
    try:
        with get_db().read() as cursor:
            if include_deleted:
                cursor.execute(
                    "SELECT COUNT(*) FROM clinical_templates WHERE template_key = ?",
                    (template_key,),
                )
            else:
                cursor.execute(
                    "SELECT COUNT(*) FROM clinical_templates WHERE template_key = ? AND deleted = FALSE",
                    (template_key,),
                )
            count = cursor.fetchone()[0]
            return count > 0
    except Exception as e:
        logging.error(f"Error checking template existence: {e}")
        raise


def get_template_fields(template_key: str) -> list[TemplateField]:
    """
    Get all fields for a specific template.

    Args:
        template_key (str): The key of the template.

    Returns:
        List[TemplateField]: List of template fields.

    Raises:
        ValueError: If template doesn't exist or is deleted.
    """
    try:
        template = get_template_by_key(template_key)
        if not template:
            raise ValueError(f"Template with key {template_key} not found")

        return [TemplateField(**field) for field in template["fields"]]
    except Exception as e:
        logging.error(f"Error getting template fields: {e}")
        raise


def get_persistent_fields(template_key: str) -> list[TemplateField]:
    """
    Get only the persistent fields for a template.

    Args:
        template_key (str): The key of the template.

    Returns:
        List[TemplateField]: List of persistent template fields.
    """
    try:
        fields = get_template_fields(template_key)
        return [field for field in fields if field.persistent]
    except Exception as e:
        logging.error(f"Error getting persistent fields: {e}")
        raise


def set_default_template(template_key: str) -> None:
    """
    Set the default template.

    Args:
        template_key (str): The key of the template to set as default
    """
    try:
        with get_db().transaction() as cursor:
            # Verify template exists
            cursor.execute(
                "SELECT template_key, deleted FROM clinical_templates WHERE template_key = ?",
                (template_key,),
            )
            template = cursor.fetchone()
            logging.info(f"Found template: {dict(template) if template else None}")

            if not template:
                raise ValueError(f"Template with key {template_key} does not exist")
            if template["deleted"]:
                raise ValueError(f"Template with key {template_key} is marked as deleted")

            # Get the first user settings record or create if none exists
            cursor.execute("SELECT id FROM user_settings LIMIT 1")
            row = cursor.fetchone()

            if row:
                # Update existing settings
                logging.info(f"Updating default template to {template_key} in database")
                cursor.execute(
                    "UPDATE user_settings SET default_template_key = ? WHERE id = ?",
                    (template_key, row["id"]),
                )
            else:
                # Create new settings record

                cursor.execute(
                    "INSERT INTO user_settings (default_template_key) VALUES (?)",
                    (template_key,),
                )

            logging.info(f"Successfully set default template to {template_key} in database")
    except Exception as e:
        logging.error(f"Error setting default template: {e}")
        raise


def get_default_template() -> dict[str, Any] | None:
    """
    Get the default template.

    Returns:
        Optional[Dict[str, Any]]: The default template if set, None otherwise
    """
    try:
        with get_db().read() as cursor:
            cursor.execute("SELECT default_template_key FROM user_settings LIMIT 1")
            row = cursor.fetchone()
            logging.info(f"Retrieved user settings row: {dict(row) if row else None}")

        if row and row["default_template_key"]:
            template_key = row["default_template_key"]
            template = get_template_by_key(template_key)
            logging.info(f"Successfully retrieved template {template_key}.")
            return template

        logging.info("No default template set")
        return None
    except Exception as e:
        logging.error(f"Error getting default template: {e}")
        raise


def update_field_adaptive_instructions(
    template_key: str, field_key: str, new_instructions: list[str]
) -> bool:
    """
    Update the adaptive_refinement_instructions for a specific field within a template.

    Args:
        template_key: The key of the template to update.
        field_key: The key of the field to update.
        new_instructions: The new list of adaptive refinement instructions.

    Returns:
        True if the update was successful, False otherwise.
    """
    logging.info(
        f"Attempting to update adaptive instructions for template '{template_key}', field '{field_key}'"
    )
    try:
        with get_db().transaction() as cursor:
            cursor.execute(
                "SELECT fields FROM clinical_templates WHERE template_key = ?",
                (template_key,),
            )
            row = cursor.fetchone()
            if not row:
                logging.error(
                    f"Template '{template_key}' not found for updating field instructions."
                )
                return False

            fields_list = json.loads(row["fields"])
            if not isinstance(fields_list, list):
                logging.error(
                    f"Fields data for template '{template_key}' is not a list or is missing."
                )
                return False

            for field_dict in fields_list:
                if isinstance(field_dict, dict) and field_dict.get("field_key") == field_key:
                    field_dict["adaptive_refinement_instructions"] = new_instructions
                    break
            else:
                logging.error(f"Field '{field_key}' not found in template '{template_key}'.")
                return False

            cursor.execute(
                """
                UPDATE clinical_templates
                SET fields = ?, updated_at = ?
                WHERE template_key = ?
                """,
                (json.dumps(fields_list), datetime.now().isoformat(), template_key),
            )

        logging.info(
            f"Successfully updated fields and timestamp for template '{template_key}' in database."
        )
        return True

    except json.JSONDecodeError as je:
        logging.error(
            f"JSON decode error for template '{template_key}': {je}",
            exc_info=True,
        )
        return False
    except Exception as e:
        logging.error(
            f"Error updating adaptive instructions for template '{template_key}', field '{field_key}': {e}",
            exc_info=True,
        )
        return False
