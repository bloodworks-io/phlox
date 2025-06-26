from typing import List, Dict, Optional, Any
from datetime import datetime
import json
import logging
from server.database.connection import db
from server.schemas.templates import (
    FormatStyle,
    ClinicalTemplate,
    TemplateField,
)


def get_template_by_key(
    template_key: str, exact_match: bool = True
) -> Optional[Dict[str, Any]]:
    """
    Retrieve a template by its key.

    Args:
        template_key: The template key to search for
        exact_match: If True, finds exact key match. If False, finds latest version of base key
    """
    try:
        if exact_match:
            db.cursor.execute(
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
            db.cursor.execute(
                """
                SELECT template_key, template_name, fields
                FROM clinical_templates
                WHERE template_key LIKE ? AND deleted = FALSE
                ORDER BY template_key DESC LIMIT 1
                """,
                (f"{base_key}_%",),
            )

        row = db.cursor.fetchone()
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


def get_all_templates() -> List[Dict[str, Any]]:
    """
    Retrieve all available templates.
    """
    try:
        db.cursor.execute(
            """
            SELECT template_key, template_name, fields
            FROM clinical_templates
            WHERE deleted = FALSE
            ORDER BY template_name
            """
        )
        templates = []
        for row in db.cursor.fetchall():
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
        if template_exists(template.template_key):
            raise ValueError(
                f"Template with key {template.template_key} already exists"
            )

        now = datetime.now().isoformat()
        db.cursor.execute(
            """
            INSERT INTO clinical_templates
            (template_key, template_name, fields, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                template.template_key,
                template.template_name,
                json.dumps([field.dict() for field in template.fields]),
                now,
                now,
            ),
        )
        db.commit()
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
        base_key = template.template_key.split("_")[0]

        # Get the current version of the template
        db.cursor.execute(
            """
            SELECT template_key, template_name, fields
            FROM clinical_templates
            WHERE template_key LIKE ? AND deleted = FALSE
            ORDER BY template_key DESC LIMIT 1
            """,
            (f"{base_key}_%",),
        )
        current = db.cursor.fetchone()

        if current:
            # Compare current and new content
            current_fields = json.loads(current["fields"])
            new_fields = [field.dict() for field in template.fields]

            # Copy over previous adaptive refinement instructions
            current_fields_map = {
                f["field_key"]: f for f in current_fields if "field_key" in f
            }
            for field in new_fields:
                prev = current_fields_map.get(field.get("field_key"))
                if prev:
                    if (
                        "adaptive_refinement_instructions" not in field
                        or not field["adaptive_refinement_instructions"]
                    ):
                        # Only copy if previous version had something to copy
                        if prev.get("adaptive_refinement_instructions"):
                            field["adaptive_refinement_instructions"] = prev[
                                "adaptive_refinement_instructions"
                            ]
            # Only update if there are actual changes
            if (
                current["template_name"] == template.template_name
                and current_fields == new_fields
            ):
                return current[
                    "template_key"
                ]  # Return existing key if no changes

        # If we get here, there are changes, so create new version
        # Check if this template is currently the default
        db.cursor.execute(
            "SELECT default_template_key FROM user_settings LIMIT 1"
        )
        settings = db.cursor.fetchone()
        is_default = (
            settings
            and settings["default_template_key"] == template.template_key
        )

        # Get the latest version number
        db.cursor.execute(
            """
            SELECT template_key FROM clinical_templates
            WHERE template_key LIKE ?
            ORDER BY template_key DESC LIMIT 1
            """,
            (f"{base_key}_%",),
        )
        result = db.cursor.fetchone()

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
        db.cursor.execute(
            """
            UPDATE clinical_templates
            SET deleted = TRUE
            WHERE template_key LIKE ? AND deleted = FALSE
            """,
            (f"{base_key}_%",),
        )

        # Insert new version
        now = datetime.now().isoformat()
        db.cursor.execute(
            """
            INSERT INTO clinical_templates
            (template_key, template_name, fields, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                new_template_key,
                template.template_name,
                json.dumps([field.dict() for field in template.fields]),
                now,
                now,
            ),
        )

        # If this was the default template, update the default to the new version
        if is_default:
            db.cursor.execute(
                """
                UPDATE user_settings
                SET default_template_key = ?
                WHERE default_template_key = ?
                """,
                (new_template_key, template.template_key),
            )
            logging.info(
                f"Updated default template to new version: {new_template_key}"
            )

        db.commit()
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
        now = datetime.now().isoformat()
        db.cursor.execute(
            """
            UPDATE clinical_templates
            SET deleted = TRUE,
                updated_at = ?
            WHERE template_key = ?
            """,
            (now, template_key),
        )
        db.commit()
        return db.cursor.rowcount > 0
    except Exception as e:
        logging.error(f"Error soft deleting template: {e}")
        raise


def restore_template(template_key: str) -> bool:
    """
    Restore a soft-deleted template.

    Args:
        template_key (str): The key of the template to restore.

    Returns:
        bool: True if restored successfully.
    """
    try:
        now = datetime.now().isoformat()
        db.cursor.execute(
            """
            UPDATE clinical_templates
            SET deleted = FALSE,
                updated_at = ?
            WHERE template_key = ?
            """,
            (now, template_key),
        )
        db.commit()
        return db.cursor.rowcount > 0
    except Exception as e:
        logging.error(f"Error restoring template: {e}")
        raise


def template_exists(template_key: str) -> bool:
    """
    Check if a template exists (including deleted ones).

    Args:
        template_key (str): The key of the template to check.

    Returns:
        bool: True if the template exists.
    """
    try:
        db.cursor.execute(
            "SELECT COUNT(*) FROM clinical_templates WHERE template_key = ?",
            (template_key,),
        )
        count = db.cursor.fetchone()[0]
        return count > 0
    except Exception as e:
        logging.error(f"Error checking template existence: {e}")
        raise


def get_template_fields(template_key: str) -> List[TemplateField]:
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


def get_persistent_fields(template_key: str) -> List[TemplateField]:
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


def get_template_field(
    template_key: str, field_key: str
) -> Optional[TemplateField]:
    """
    Get a specific field from a template.

    Args:
        template_key (str): The key of the template.
        field_key (str): The key of the field.

    Returns:
        Optional[TemplateField]: The field if found.
    """
    try:
        fields = get_template_fields(template_key)
        for field in fields:
            if field.field_key == field_key:
                return field
        return None
    except Exception as e:
        logging.error(f"Error getting template field: {e}")
        raise


def validate_template_data(
    template_key: str, template_data: Dict[str, Any]
) -> bool:
    """
    Validate template data against template fields.
    Ensures plan is properly formatted.
    """
    try:
        fields = get_template_fields(template_key)

        # Check required fields
        for field in fields:
            if field.required and field.field_key not in template_data:
                raise ValueError(f"Required field {field.field_key} is missing")

            # Special validation for plan field
            if field.field_key == "plan":
                plan_text = template_data.get("plan", "")
                if not plan_text:
                    raise ValueError("Plan is required")

                # Check if plan items are numbered
                lines = [
                    line.strip()
                    for line in plan_text.split("\n")
                    if line.strip()
                ]
                for line in lines:
                    if not line[0].isdigit() or "." not in line:
                        raise ValueError(
                            "Plan items must be numbered (e.g., '1. Action item')"
                        )

        return True
    except Exception as e:
        logging.error(f"Error validating template data: {e}")
        raise


def set_default_template(template_key: str) -> None:
    """
    Set the default template.

    Args:
        template_key (str): The key of the template to set as default
    """
    try:
        # Verify template exists
        db.cursor.execute(
            "SELECT template_key, deleted FROM clinical_templates WHERE template_key = ?",
            (template_key,),
        )
        template = db.cursor.fetchone()
        logging.info(f"Found template: {dict(template) if template else None}")

        if not template:
            raise ValueError(f"Template with key {template_key} does not exist")
        if template["deleted"]:
            raise ValueError(
                f"Template with key {template_key} is marked as deleted"
            )

        # Get the first user settings record or create if none exists
        db.cursor.execute("SELECT id FROM user_settings LIMIT 1")
        row = db.cursor.fetchone()

        if row:
            # Update existing settings
            logging.info(
                f"Updating default template to {template_key} in database"
            )
            db.cursor.execute(
                "UPDATE user_settings SET default_template_key = ? WHERE id = ?",
                (template_key, row["id"]),
            )
        else:
            # Create new settings record

            db.cursor.execute(
                "INSERT INTO user_settings (default_template_key) VALUES (?)",
                (template_key,),
            )

        db.commit()
        logging.info(
            f"Successfully set default template to {template_key} in database"
        )
    except Exception as e:
        logging.error(f"Error setting default template: {e}")
        raise


def get_default_template() -> Optional[Dict[str, Any]]:
    """
    Get the default template.

    Returns:
        Optional[Dict[str, Any]]: The default template if set, None otherwise
    """
    try:
        db.cursor.execute(
            "SELECT default_template_key FROM user_settings LIMIT 1"
        )
        row = db.cursor.fetchone()
        logging.info(
            f"Retrieved user settings row: {dict(row) if row else None}"
        )

        if row and row["default_template_key"]:
            template_key = row["default_template_key"]
            template = get_template_by_key(template_key)
            logging.info(
                f"Successfully retrieved template {template_key}."
            )
            return template

        logging.info("No default template set")
        return None
    except Exception as e:
        logging.error(f"Error getting default template: {e}")
        raise


def update_field_adaptive_instructions(
    template_key: str, field_key: str, new_instructions: List[str]
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
        # Fetch the current template data using exact match
        template_data = get_template_by_key(template_key, exact_match=True)
        if not template_data:
            logging.error(
                f"Template '{template_key}' not found for updating field instructions."
            )
            # As per instruction: "raise a ValueError or log an error and return False"
            # Choosing to log and return False for consistency with some other functions
            # that don't directly interact with API layer HTTPExceptions.
            return False

        # fields are already parsed by get_template_by_key
        fields_list = template_data.get("fields")
        if not isinstance(fields_list, list):
            logging.error(
                f"Fields data for template '{template_key}' is not a list or is missing."
            )
            return False

        field_found = False
        updated_fields_list = []

        for field_dict in fields_list:
            if (
                isinstance(field_dict, dict)
                and field_dict.get("field_key") == field_key
            ):
                field_found = True
                field_dict["adaptive_refinement_instructions"] = (
                    new_instructions
                )
                logging.info(
                    f"Updated instructions for field '{field_key}' in template '{template_key}'."
                )
            updated_fields_list.append(field_dict)

        if not field_found:
            logging.error(
                f"Field '{field_key}' not found in template '{template_key}'."
            )
            return False

        # Serialize the modified list of field dictionaries back into a JSON string
        updated_fields_json = json.dumps(updated_fields_list)
        current_timestamp = datetime.now().isoformat()

        # Update the clinical_templates table
        db.cursor.execute(
            """
            UPDATE clinical_templates
            SET fields = ?, updated_at = ?
            WHERE template_key = ?
            """,
            (updated_fields_json, current_timestamp, template_key),
        )
        db.commit()

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
        # Attempt to rollback in case of partial transaction failure if applicable, though simple UPDATEs are often atomic.
        # db.rollback() # db object does not seem to have rollback based on PatientDatabase structure
        return False
