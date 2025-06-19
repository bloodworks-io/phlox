import logging
from typing import List, Dict, Optional, Any
from datetime import datetime
from server.database.connection import db
from server.schemas.letter import LetterTemplate


def update_patient_letter(patient_id: int, letter: str) -> None:
    """
    Update a patient's final letter.

    Args:
        patient_id (int): The patient's ID.
        letter (str): The letter content.
    """
    try:
        db.cursor.execute(
            """
            UPDATE patients
            SET final_letter = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (letter, datetime.now().isoformat(), patient_id),
        )
        db.commit()
    except Exception as e:
        logging.error(f"Error updating patient letter: {e}")
        raise


async def fetch_patient_letter(patient_id: int) -> Optional[str]:
    """
    Fetch a patient's final letter.

    Args:
        patient_id (int): The patient's ID.

    Returns:
        Optional[str]: The letter content if found.
    """
    try:
        db.cursor.execute(
            "SELECT final_letter FROM patients WHERE id = ?", (patient_id,)
        )
        row = db.cursor.fetchone()
        return row["final_letter"] if row else None
    except Exception as e:
        logging.error(f"Error fetching patient letter: {e}")
        raise


def get_letter_templates() -> List[Dict[str, Any]]:
    """
    Retrieve all letter templates.

    Returns:
        List[Dict[str, Any]]: List of letter templates.
    """
    try:
        db.cursor.execute(
            """
            SELECT id, name, instructions, created_at
            FROM letter_templates
            ORDER BY name
            """
        )
        return [dict(row) for row in db.cursor.fetchall()]
    except Exception as e:
        logging.error(f"Error fetching letter templates: {e}")
        raise


def get_letter_template_by_id(template_id: int) -> Optional[Dict[str, Any]]:
    """
    Retrieve a specific letter template by ID.

    Args:
        template_id (int): ID of the template to retrieve.

    Returns:
        Optional[Dict[str, Any]]: Template data if found.
    """
    try:
        db.cursor.execute(
            """
            SELECT id, name, instructions, created_at
            FROM letter_templates
            WHERE id = ?
            """,
            (template_id,),
        )
        row = db.cursor.fetchone()
        return dict(row) if row else None
    except Exception as e:
        logging.error(f"Error fetching letter template: {e}")
        raise


def save_letter_template(template: LetterTemplate) -> int:
    """
    Save a new letter template.

    Args:
        template (LetterTemplate): Template to save.

    Returns:
        int: ID of the newly created template.
    """
    try:
        db.cursor.execute(
            """
            INSERT INTO letter_templates (name, instructions)
            VALUES (?, ?)
            """,
            (template.name, template.instructions),
        )
        db.commit()
        return db.cursor.lastrowid
    except Exception as e:
        logging.error(f"Error saving letter template: {e}")
        raise


def update_letter_template(template_id: int, template: LetterTemplate) -> bool:
    """
    Update an existing letter template.

    Args:
        template_id (int): ID of template to update.
        template (LetterTemplate): Updated template data.

    Returns:
        bool: True if updated successfully.
    """
    try:
        db.cursor.execute(
            """
            UPDATE letter_templates
            SET name = ?,
                instructions = ?
            WHERE id = ?
            """,
            (template.name, template.instructions, template_id),
        )
        db.commit()
        return db.cursor.rowcount > 0
    except Exception as e:
        logging.error(f"Error updating letter template: {e}")
        raise


def delete_letter_template(template_id: int) -> bool:
    """
    Delete a letter template.

    Args:
        template_id (int): ID of template to delete.

    Returns:
        bool: True if deleted successfully.
    """
    try:
        db.cursor.execute(
            "DELETE FROM letter_templates WHERE id = ?", (template_id,)
        )
        db.commit()
        return db.cursor.rowcount > 0
    except Exception as e:
        logging.error(f"Error deleting letter template: {e}")
        raise


def reset_default_templates() -> None:
    """
    Reset to default letter templates by clearing and reinserting defaults.
    """
    try:
        # Clear existing templates
        db.cursor.execute("DELETE FROM letter_templates")

        # Insert defaults
        default_templates = [
            (
                "GP Letter",
                "Write a brief letter to the patient's general practitioner summarizing the consultation",
            ),
            (
                "Specialist Referral",
                "Write a detailed referral letter to a specialist including relevant history and examination findings",
            ),
            (
                "Discharge Summary",
                "Write a comprehensive discharge summary including admission details, treatment, and follow-up plan",
            ),
            (
                "Brief Update",
                "Write a short update letter focusing only on recent changes and current plan",
            ),
        ]

        db.cursor.executemany(
            "INSERT INTO letter_templates (name, instructions) VALUES (?, ?)",
            default_templates,
        )
        db.commit()
    except Exception as e:
        logging.error(f"Error resetting letter templates: {e}")
        raise
