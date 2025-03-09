from typing import List, Dict, Optional, Any
from datetime import datetime
import json
import logging
from server.database.connection import PatientDatabase
from server.database.defaults.templates import DefaultTemplates
from server.schemas.templates import ClinicalTemplate, TemplateField, ExtractedTemplate
from server.database.config import config_manager
import time
from ollama import AsyncClient as AsyncOllamaClient

# Initialize database connection
db = PatientDatabase()

def get_template_by_key(template_key: str, exact_match: bool = True) -> Optional[Dict[str, Any]]:
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
                (template_key,)
            )
        else:
            # Get latest version of template
            base_key = template_key.split('_')[0]
            db.cursor.execute(
                """
                SELECT template_key, template_name, fields
                FROM clinical_templates
                WHERE template_key LIKE ? AND deleted = FALSE
                ORDER BY template_key DESC LIMIT 1
                """,
                (f"{base_key}_%",)
            )

        row = db.cursor.fetchone()
        if row:
            return {
                "template_key": row["template_key"],
                "template_name": row["template_name"],
                "fields": json.loads(row["fields"])
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
            templates.append({
                "template_key": row["template_key"],
                "template_name": row["template_name"],
                "fields": json.loads(row["fields"])
            })
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
            raise ValueError(f"Template with key {template.template_key} already exists")

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
                now
            )
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
        base_key = template.template_key.split('_')[0]

        # Get the current version of the template
        db.cursor.execute(
            """
            SELECT template_key, template_name, fields
            FROM clinical_templates
            WHERE template_key LIKE ? AND deleted = FALSE
            ORDER BY template_key DESC LIMIT 1
            """,
            (f"{base_key}_%",)
        )
        current = db.cursor.fetchone()

        if current:
            # Compare current and new content
            current_fields = json.loads(current["fields"])
            new_fields = [field.dict() for field in template.fields]

            # Only update if there are actual changes
            if (current["template_name"] == template.template_name and
                current_fields == new_fields):
                return current["template_key"]  # Return existing key if no changes

        # If we get here, there are changes, so create new version
        # Check if this template is currently the default
        db.cursor.execute(
            "SELECT default_template_key FROM user_settings LIMIT 1"
        )
        settings = db.cursor.fetchone()
        is_default = settings and settings["default_template_key"] == template.template_key


        # Get the latest version number
        db.cursor.execute(
            """
            SELECT template_key FROM clinical_templates
            WHERE template_key LIKE ?
            ORDER BY template_key DESC LIMIT 1
            """,
            (f"{base_key}_%",)
        )
        result = db.cursor.fetchone()

        current_version = 0
        if result:
            try:
                current_version = int(result['template_key'].split('_')[-1])
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
            (f"{base_key}_%",)
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
                now
            )
        )

        # If this was the default template, update the default to the new version
        if is_default:
            db.cursor.execute(
                """
                UPDATE user_settings
                SET default_template_key = ?
                WHERE default_template_key = ?
                """,
                (new_template_key, template.template_key)
            )
            logging.info(f"Updated default template to new version: {new_template_key}")

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
            (now, template_key)
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
            (now, template_key)
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
            (template_key,)
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
    template_key: str,
    field_key: str
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

def validate_template_data(template_key: str, template_data: Dict[str, Any]) -> bool:
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
                lines = [line.strip() for line in plan_text.split('\n') if line.strip()]
                for line in lines:
                    if not line[0].isdigit() or '.' not in line:
                        raise ValueError("Plan items must be numbered (e.g., '1. Action item')")

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
            (template_key,)
        )
        template = db.cursor.fetchone()
        logging.info(f"Found template: {dict(template) if template else None}")

        if not template:
            raise ValueError(f"Template with key {template_key} does not exist")
        if template["deleted"]:
            raise ValueError(f"Template with key {template_key} is marked as deleted")

        # Get the first user settings record or create if none exists
        db.cursor.execute("SELECT id FROM user_settings LIMIT 1")
        row = db.cursor.fetchone()

        if row:
            # Update existing settings
            db.cursor.execute(
                "UPDATE user_settings SET default_template_key = ? WHERE id = ?",
                (template_key, row["id"])
            )
        else:
            # Create new settings record
            db.cursor.execute(
                "INSERT INTO user_settings (default_template_key) VALUES (?)",
                (template_key,)
            )

        db.commit()
        print(f"Successfully set default template to {template_key} in database")
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
        logging.info(f"Retrieved user settings row: {dict(row) if row else None}")

        if row and row["default_template_key"]:
            template_key = row["default_template_key"]
            template = get_template_by_key(template_key)
            logging.info(f"Retrieved template for key {template_key}: {template}")
            return template

        logging.info("No default template set")
        return None
    except Exception as e:
        logging.error(f"Error getting default template: {e}")
        raise

def generate_field_key(field_name: str) -> str:
    """Generate a standardized field key from a field name."""
    return field_name.lower().strip().replace(" ", "_")

def generate_unique_template_key(base_name: str) -> str:
    """
    Generate a unique template key based on the template name.
    If base name already exists, append -a, -b, -c etc.
    All template keys will have _1 appended as initial version.

    Args:
        base_name: The suggested template name to base the key on

    Returns:
        str: A unique template key with version number
    """
    base_key = generate_field_key(base_name)
    version = "_1"  # Initial version number

    # First try without any suffix
    if not template_exists(f"{base_key}{version}"):
        return f"{base_key}{version}"

    # If exists, try with suffixes -a through -z
    for suffix in (chr(i) for i in range(97, 123)):  # a through z
        test_key = f"{base_key}-{suffix}{version}"
        if not template_exists(test_key):
            return test_key

    # If we somehow run out of letters, add timestamp
    return f"{base_key}-{int(time.time())}{version}"

async def generate_template_from_note(example_note: str) -> ClinicalTemplate:
    """
    Analyzes an example note using LLM and generates a structured ClinicalTemplate.
    Extracts formatting patterns and appropriate section starters.
    """
    try:
        config = config_manager.get_config()
        client = AsyncOllamaClient(host=config["OLLAMA_BASE_URL"])

        system_prompt = """
        You are a medical documentation expert that analyzes clinical notes and creates structured templates.
        For each section:
        1. Determine the format style (bullets, numbered, narrative, etc)
        2. Identify the exact bullet/numbering pattern used (-, 1., etc), if any.
        3. Create an appropriate section starter that matches the format
        4. The section starter should include the heading and initial format marker

        Examples:
        - For bullet points: "Current Status:\n-"
        - For numbered items: "Plan:\n1."
        - For lab values: "Results:\n"
        - For narrative sections: "Assessment:\n"
        """

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Analyze this clinical note and extract template sections with their format patterns. Return as JSON:\n\n{example_note}"}
        ]

        response = await client.chat(
            model=config["PRIMARY_MODEL"],
            messages=messages,
            format=ExtractedTemplate.model_json_schema(),
            options={"temperature": 0}
        )


        content = response['message']['content']
        extracted = ExtractedTemplate.model_validate_json(content)

        # Convert extracted sections to TemplateField objects
        template_fields = []

        # Add all extracted sections except plan
        for section in extracted.sections:
            field_key = generate_field_key(section.field_name)

            if field_key != "plan":
                field = TemplateField(
                    field_key=field_key,
                    field_name=section.field_name,
                    field_type="text",
                    required=section.required,
                    persistent=section.persistent,
                    system_prompt=f"Provide information for {section.field_name} using {section.format_style.value} format.",
                    initial_prompt=section.section_starter,
                    format_schema=None,
                    refinement_rules=["default"]
                )
                template_fields.append(field)

        # Add plan field
        plan_field = DefaultTemplates.get_plan_field()
        # Find plan section by generating field_key from field_name
        plan_section = next((s for s in extracted.sections
                           if generate_field_key(s.field_name) == "plan"), None)
        if plan_section:
            plan_field["initial_prompt"] = plan_section.section_starter

        # Ensure plan field has list for refinement_rules
        if isinstance(plan_field.get("refinement_rules"), str):
            plan_field["refinement_rules"] = [plan_field["refinement_rules"]]

        template_fields.append(TemplateField(**plan_field))

        # Generate a unique template key based on the suggested name
        new_template_key = generate_unique_template_key(extracted.suggested_name)

        template = ClinicalTemplate(
            template_key=new_template_key,
            template_name=extracted.suggested_name,
            fields=template_fields,
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
        )

        return template

    except Exception as e:
        logging.error(f"Error generating template from note: {e}")
        raise
