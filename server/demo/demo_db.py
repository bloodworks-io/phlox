import datetime
import json
import random
import sys
from pathlib import Path

# Add the parent directory of 'server' to the Python path
sys.path.append("/usr/src/app")

from server.database.config.defaults.templates import DefaultTemplates
from server.database.core.connection import (
    get_db as patient_db,
)
from server.database.core.connection import (
    initialize_database,
)
from server.database.repositories.patient import upsert_patient_profile
from server.database.repositories.templates import save_template
from server.schemas.templates import ClinicalTemplate, TemplateField
from server.utils.helpers import split_name

# Get the directory of the current script
current_dir = Path(__file__).resolve().parent


def clear_database():
    """Clear existing database tables."""
    initialize_database()
    print("Clearing existing database...")
    patient_db().cursor.execute("DELETE FROM encounters")
    patient_db().cursor.execute("DELETE FROM patient_profiles")
    patient_db().cursor.execute("DELETE FROM clinical_templates")
    patient_db().commit()
    print("Database cleared.")


def initialize_templates():
    """Initialize default templates."""
    print("Initializing default templates...")
    for template_data in DefaultTemplates.get_default_templates():
        template = ClinicalTemplate(
            template_key=template_data["template_key"],
            template_name=template_data["template_name"],
            fields=[TemplateField(**field) for field in template_data["fields"]],
        )
        save_template(template)
    print("Templates initialized.")


def initialize_fake_patients():
    """Initialize database with fake patients using the Phlox template."""
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)

    json_file_path = current_dir / "example_patients.json"

    with json_file_path.open() as f:
        data = json.load(f)

    fake_patients = []
    encounter_dates = [today] * 10 + [yesterday] * 10
    random.shuffle(encounter_dates)

    for patient_data, encounter_date in zip(data["patients"], encounter_dates, strict=True):
        # Convert old format to template data
        template_data = {
            "primary_history": patient_data["primary_history"],
            "additional_history": patient_data["oahp"],
            "investigations": patient_data["investigations"],
            "clinical_history": patient_data["clinical_history"],
            "impression": patient_data["impression"],
            "plan": patient_data["plan"],
        }

        jobs_list = [
            {"id": index + 1, "job": job["job"], "completed": job["completed"]}
            for index, job in enumerate(patient_data["jobs"])
        ]
        all_jobs_completed = bool(jobs_list) and all(job["completed"] for job in jobs_list)

        patient = {
            "name": patient_data["name"],
            "dob": patient_data["dob"],
            "ur_number": patient_data["ur_number"],
            "gender": patient_data["gender"],
            "encounter_date": encounter_date.strftime("%Y-%m-%d"),
            "template_key": "phlox_01",  # Using Phlox template for example patients
            "template_data": json.dumps(template_data),
            "raw_transcription": patient_data["transcript"],
            "transcription_duration": round(random.uniform(5.0, 15.0), 2),  # nosec B311
            "process_duration": round(random.uniform(10.0, 30.0), 2),  # nosec B311
            "final_letter": patient_data["letter"],
            "primary_condition": patient_data.get("encounter_summary", "")
            .split(" with ")[-1]
            .strip("."),  # Extract primary condition from summary
            "jobs_list": json.dumps(jobs_list),
            "all_jobs_completed": all_jobs_completed,
            "encounter_summary": patient_data["encounter_summary"],
        }

        fake_patients.append(patient)

    for patient in fake_patients:
        patient_db().cursor.execute(
            """
            INSERT INTO encounters (
                ur_number, encounter_date,
                template_key, template_data, raw_transcription,
                transcription_duration, process_duration,
                jobs_list, all_jobs_completed, final_letter,
                primary_condition, encounter_summary
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient["ur_number"],
                patient["encounter_date"],
                patient["template_key"],
                patient["template_data"],
                patient["raw_transcription"],
                patient["transcription_duration"],
                patient["process_duration"],
                patient["jobs_list"],
                patient["all_jobs_completed"],
                patient["final_letter"],
                patient["primary_condition"],
                patient["encounter_summary"],
            ),
        )

        first_name, last_name = split_name(str(patient["name"]))
        upsert_patient_profile(
            str(patient["ur_number"]),
            first_name,
            last_name,
            str(patient["dob"]),
            str(patient["gender"]),
            None,
            None,
        )

    patient_db().commit()
    print(f"Initialized {len(fake_patients)} fake patients.")


def main():
    try:
        clear_database()
        initialize_templates()
        print("Initializing database with fake patients...")
        initialize_fake_patients()
        print("Initialization complete.")
    except Exception as e:
        print(f"Error during initialization: {e}")
        raise
    finally:
        patient_db().close()


def seed_demo_data_desktop():
    """Seed demo data in the desktop (Tauri) app.

    Unlike ``main``/``clear_database`` (which re-initialise the DB without a
    passphrase for Docker), this assumes the encrypted DB is already open via
    ``get_db()``. It wipes encounters/profiles/templates and re-seeds the demo
    patients, so every ``tauri dev`` launch starts from a clean, fullsome state.
    """
    db = patient_db()
    print("Clearing existing data for demo seed...")
    db.cursor.execute("DELETE FROM encounters")
    db.cursor.execute("DELETE FROM patient_profiles")
    db.cursor.execute("DELETE FROM clinical_templates")
    db.commit()
    print("Seeding demo templates and patients...")
    initialize_templates()
    initialize_fake_patients()
    print("Demo data seeded.")


if __name__ == "__main__":
    main()
