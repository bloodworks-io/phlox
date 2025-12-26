import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from server.database.core.connection import db
from server.database.entities.jobs import (
    are_all_jobs_completed,
    generate_jobs_list_from_plan,
)
from server.database.entities.templates import (
    get_persistent_fields,
    get_template_by_key,
)
from server.schemas.patient import Patient


def get_unique_primary_conditions():
    """
    Retrieve all unique primary conditions from the patients table.

    Returns:
        list: A list of unique primary condition strings, excluding None values.
    """
    try:
        db.cursor.execute(
            """
            SELECT DISTINCT primary_condition
            FROM patients
            WHERE primary_condition IS NOT NULL
            AND primary_condition != ''
            ORDER BY primary_condition ASC
            """
        )
        results = db.cursor.fetchall()
        return [row["primary_condition"] for row in results]
    except Exception as e:
        logging.error(f"Error getting unique primary conditions: {e}")
        return []


def save_patient(patient: Patient) -> int:
    """Saves patient data."""
    try:
        now = datetime.now().isoformat()

        # Generate jobs list from plan if one exists
        jobs_list = []
        if hasattr(patient, "template_data"):
            template_data = (
                json.loads(patient.template_data)
                if isinstance(patient.template_data, str)
                else patient.template_data
            )
            if plan := template_data.get("plan"):
                jobs_list = generate_jobs_list_from_plan(plan)

        # Check if all jobs are completed
        all_jobs_completed = are_all_jobs_completed(jobs_list)

        # Ensure jobs_list is properly serialized as JSON string
        jobs_list_json = (
            json.dumps(jobs_list)
            if isinstance(jobs_list, (list, dict))
            else jobs_list if isinstance(jobs_list, str) else "[]"
        )
        db.cursor.execute(
            """
            INSERT INTO patients (
                name, dob, ur_number, gender, encounter_date,
                template_key, template_data, raw_transcription,
                transcription_duration, process_duration,
                primary_condition, final_letter, jobs_list,
                all_jobs_completed, encounter_summary,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient.name,
                patient.dob,
                patient.ur_number,
                patient.gender,
                patient.encounter_date,
                patient.template_key,
                json.dumps(patient.template_data),
                patient.raw_transcription,
                patient.transcription_duration,
                patient.process_duration,
                getattr(patient, "primary_condition", None),
                getattr(patient, "final_letter", None),
                jobs_list_json,  # Use generated jobs list instead of getting from patient
                all_jobs_completed,
                getattr(patient, "encounter_summary", None),
                now,
                now,
            ),
        )
        db.commit()
        return db.cursor.lastrowid
    except Exception as e:
        db.db.rollback()
        logging.error(f"Error saving patient: {e}")
        raise


def update_patient(patient: Patient) -> None:
    """
    Update an existing patient in the database.

    Args:
        patient (Patient): The patient object with updated information.
    """

    # First get existing patient data
    db.cursor.execute(
        "SELECT template_data, jobs_list FROM patients WHERE id = ?",
        (patient.id,),
    )
    row = db.cursor.fetchone()

    # Extract plans for comparison
    current_template_data = {}
    if row:
        # Convert row to dict if it's not already
        row_dict = dict(row) if row else {}

        if row_dict.get("template_data"):
            try:
                current_template_data = (
                    json.loads(row_dict["template_data"])
                    if isinstance(row_dict["template_data"], str)
                    else row_dict["template_data"]
                )
            except json.JSONDecodeError:
                current_template_data = {}

    new_template_data = {}
    if patient.template_data:
        try:
            new_template_data = (
                json.loads(patient.template_data)
                if isinstance(patient.template_data, str)
                else patient.template_data
            )

        except json.JSONDecodeError:
            new_template_data = {}

    # Compare plans
    current_plan = current_template_data.get("plan", "").strip()
    new_plan = new_template_data.get("plan", "").strip()

    # Handle jobs list updates
    if current_plan != new_plan:
        # Plan changed, generate new jobs list

        jobs_list = generate_jobs_list_from_plan(new_plan)
    else:
        # Plan unchanged, handle existing jobs list
        jobs_list = []
        if row:
            row_dict = dict(row)
            if row_dict.get("jobs_list"):
                try:
                    jobs_list = (
                        json.loads(row_dict["jobs_list"])
                        if isinstance(row_dict["jobs_list"], str)
                        else row_dict["jobs_list"]
                    )
                except json.JSONDecodeError:
                    jobs_list = []

        # If no jobs list exists but we have patient jobs list data
        if not jobs_list and hasattr(patient, "jobs_list"):
            try:
                jobs_list = (
                    json.loads(patient.jobs_list)
                    if isinstance(patient.jobs_list, str)
                    else patient.jobs_list
                )
            except (json.JSONDecodeError, AttributeError):
                jobs_list = []

        # If still no jobs list but we have a plan, generate from plan
        if not jobs_list and new_plan:
            jobs_list = generate_jobs_list_from_plan(new_plan)

    # Check if all jobs are completed
    all_jobs_completed = are_all_jobs_completed(jobs_list)

    # Ensure template_data is properly serialized
    template_data_json = (
        json.dumps(patient.template_data)
        if isinstance(patient.template_data, dict)
        else patient.template_data
    )

    # Ensure jobs_list is properly serialized as JSON string
    jobs_list_json = (
        json.dumps(jobs_list)
        if isinstance(jobs_list, (list, dict))
        else jobs_list if isinstance(jobs_list, str) else "[]"
    )

    # Update the database
    db.cursor.execute(
        """
        UPDATE patients
        SET name = ?,
            dob = ?,
            ur_number = ?,
            gender = ?,
            encounter_date = ?,
            template_key = ?,
            template_data = ?,
            raw_transcription = ?,
            transcription_duration = ?,
            process_duration = ?,
            primary_condition = ?,
            final_letter = ?,
            encounter_summary = ?,
            jobs_list = ?,
            all_jobs_completed = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            patient.name,
            patient.dob,
            patient.ur_number,
            patient.gender,
            patient.encounter_date,
            patient.template_key,
            template_data_json,
            patient.raw_transcription,
            patient.transcription_duration,
            patient.process_duration,
            patient.primary_condition,
            patient.final_letter,
            patient.encounter_summary,
            jobs_list_json,
            all_jobs_completed,
            datetime.now().isoformat(),
            patient.id,
        ),
    )
    db.commit()


def update_patient_reasoning(patient_id: int, reasoning_output: dict) -> None:
    """
    Update the reasoning_output field for the specified patient.

    Args:
        patient_id (int): The ID of the patient.
        reasoning_output (dict): The reasoning output data.
    """
    try:
        reasoning_output_json = json.dumps(reasoning_output)
        db.cursor.execute(
            "UPDATE patients SET reasoning_output = ? WHERE id = ?",
            (reasoning_output_json, patient_id),
        )
        db.commit()
    except Exception as e:
        db.db.rollback()
        logging.error(f"Error updating patient reasoning: {e}")
        raise


def get_patients_by_date(
    date: str, template_key: Optional[str] = None, include_data: bool = False
) -> List[Dict[str, Any]]:
    """
    Retrieve patients with encounters on a specific date.

    Args:
        date (str): The encounter date.
        template_key (Optional[str]): Filter by template.
        include_data (bool): Whether to include template data and jobs information.

    Returns:
        List[Dict[str, Any]]: List of matching patient records.
    """
    try:
        query = """
            SELECT id, name, ur_number, dob, gender, encounter_date, template_key
            """

        # Add additional fields if detailed information is requested
        if include_data:
            query += ", template_data, jobs_list, encounter_summary, reasoning_output"

        query += " FROM patients WHERE encounter_date = ?"
        params = [date]

        if template_key:
            query += " AND template_key = ?"
            params.append(template_key)

        query += " ORDER BY name"

        db.cursor.execute(query, params)
        patients = []
        for row in db.cursor.fetchall():
            patient = dict(row)

            # Process template data if included
            if include_data:
                if patient.get("template_data"):
                    try:
                        template_data = json.loads(patient["template_data"])
                        patient["template_data"] = template_data
                        # Extract plan from template data if exists
                        if template_data:
                            patient["plan"] = template_data.get("plan", "")
                    except json.JSONDecodeError:
                        patient["template_data"] = {}

                # Process jobs list if included
                if patient.get("jobs_list"):
                    try:
                        patient["jobs_list"] = json.loads(patient["jobs_list"])
                    except json.JSONDecodeError:
                        patient["jobs_list"] = []

                # Process reasoning output if present
                if patient.get("reasoning_output"):
                    try:
                        patient["reasoning_output"] = json.loads(
                            patient["reasoning_output"]
                        )
                    except json.JSONDecodeError:
                        patient["reasoning_output"] = None

            patients.append(patient)
        return patients
    except Exception as e:
        logging.error(f"Error fetching patients by date: {e}")
        raise


def get_patient_by_id(patient_id: int) -> Optional[Dict[str, Any]]:
    """
    Retrieve a patient by ID.

    Args:
        patient_id (int): The patient's ID.

    Returns:
        Optional[Dict[str, Any]]: Patient data if found.
    """
    try:
        db.cursor.execute("SELECT * FROM patients WHERE id = ?", (patient_id,))
        row = db.cursor.fetchone()
        if row:
            patient = dict(row)
            if patient["template_data"]:
                patient["template_data"] = json.loads(patient["template_data"])

            if patient.get("reasoning_output"):
                try:
                    patient["reasoning_output"] = json.loads(
                        patient["reasoning_output"]
                    )
                except json.JSONDecodeError:
                    patient["reasoning_output"] = None
            return patient
        return None
    except Exception as e:
        logging.error(f"Error fetching patient by ID: {e}")
        raise


def get_patient_history(ur_number: str) -> List[Dict[str, Any]]:
    """
    Get a patient's historical encounters with persistent fields.

    Args:
        ur_number (str): The patient's UR number.

    Returns:
        List[Dict[str, Any]]: List of historical encounters.
    """
    try:
        db.cursor.execute(
            """
            SELECT id, encounter_date, template_key, template_data
            FROM patients
            WHERE ur_number = ?
            ORDER BY encounter_date DESC
            """,
            (ur_number,),
        )

        encounters = []
        for row in db.cursor.fetchall():
            template = get_template_by_key(row["template_key"])
            if not template:
                continue

            persistent_fields = get_persistent_fields(row["template_key"])
            template_data = (
                json.loads(row["template_data"]) if row["template_data"] else {}
            )

            persistent_data = {
                field.field_key: template_data.get(field.field_key)
                for field in persistent_fields
            }

            encounters.append(
                {
                    "id": row["id"],
                    "encounter_date": row["encounter_date"],
                    "template_key": row["template_key"],
                    "template_data": persistent_data,
                }
            )

        return encounters
    except Exception as e:
        logging.error(f"Error fetching patient history: {e}")
        raise


def search_patient_by_ur_number(ur_number: str) -> List[Dict[str, Any]]:
    """
    Search for patients by UR number, returning data in the same format as get_patient_history.

    Args:
        ur_number (str): The UR number to search for.

    Returns:
        List[Dict[str, Any]]: Matching patient records in history format.
    """
    try:
        db.cursor.execute(
            """
            SELECT id, name, gender, dob, ur_number, encounter_date, template_key, template_data
            FROM patients
            WHERE ur_number = ?
            ORDER BY encounter_date DESC
            LIMIT 1
            """,
            (ur_number,),
        )

        encounters = []
        row = db.cursor.fetchone()
        if row:
            template = get_template_by_key(row["template_key"])
            if template:
                persistent_fields = get_persistent_fields(row["template_key"])
                template_data = (
                    json.loads(row["template_data"])
                    if row["template_data"]
                    else {}
                )

                persistent_data = {
                    field.field_key: template_data.get(field.field_key)
                    for field in persistent_fields
                }

                encounters.append(
                    {
                        "id": row["id"],
                        "name": row["name"],
                        "gender": row["gender"],
                        "dob": row["dob"],
                        "ur_number": row["ur_number"],
                        "encounter_date": row["encounter_date"],
                        "template_key": row["template_key"],
                        "template_data": persistent_data,
                    }
                )

        return encounters
    except Exception as e:
        logging.error(f"Error searching patients: {e}")
        raise


def delete_patient_by_id(patient_id: int) -> bool:
    """
    Delete a patient record.

    Args:
        patient_id (int): The ID of the patient to delete.

    Returns:
        bool: True if deleted successfully.
    """
    try:
        db.cursor.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
        db.commit()
        return db.cursor.rowcount > 0
    except Exception as e:
        logging.error(f"Error deleting patient: {e}")
        raise
