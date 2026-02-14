import datetime
import json
import os
import random
import sys
from typing import Dict, List

# Add the parent directory of 'server' to the Python path
sys.path.append("/usr/src/app")

from server.database.config.defaults.templates import DefaultTemplates
from server.database.core.connection import get_db as patient_db
from server.database.entities.templates import save_template
from server.schemas.templates import ClinicalTemplate, TemplateField

# Get the directory of the current script
current_dir = os.path.dirname(os.path.abspath(__file__))


def generate_jobs_list_from_plan(plan: str) -> List[Dict]:
    """Generate a jobs list from a numbered plan."""
    jobs = [
        item.strip()
        for item in plan.split("\n")
        if item.strip() and item.strip()[0].isdigit()
    ]
    jobs_list = [
        {"id": index + 1, "job": job, "completed": False}
        for index, job in enumerate(jobs)
    ]
    return jobs_list


def clear_database():
    """Clear existing database tables."""
    print("Clearing existing database...")
    patient_db().cursor.execute("DELETE FROM patients")
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
            fields=[
                TemplateField(**field) for field in template_data["fields"]
            ],
        )
        save_template(template)
    print("Templates initialized.")


def initialize_fake_patients():
    """Initialize database with fake patients using the Phlox template."""
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)

    json_file_path = os.path.join(current_dir, "example_patients.json")

    with open(json_file_path, "r") as f:
        data = json.load(f)

    fake_patients = []
    encounter_dates = [today] * 10 + [yesterday] * 10
    random.shuffle(encounter_dates)

    for patient_data, encounter_date in zip(data["patients"], encounter_dates):
        # Convert old format to template data
        template_data = {
            "primary_history": patient_data["primary_history"],
            "additional_history": patient_data["oahp"],
            "investigations": patient_data["investigations"],
            "clinical_history": patient_data["clinical_history"],
            "impression": patient_data["impression"],
            "plan": patient_data["plan"],
        }

        # Generate jobs list from the plan in template data
        jobs_list = generate_jobs_list_from_plan(template_data["plan"])

        patient = {
            "name": patient_data["name"],
            "dob": patient_data["dob"],
            "ur_number": patient_data["ur_number"],
            "gender": patient_data["gender"],
            "encounter_date": encounter_date.strftime("%Y-%m-%d"),
            "template_key": "phlox_01",  # Using Phlox template for example patients
            "template_data": json.dumps(template_data),
            "raw_transcription": f"Raw transcription for {patient_data['name']}",
            "transcription_duration": round(random.uniform(5.0, 15.0), 2),
            "process_duration": round(random.uniform(10.0, 30.0), 2),
            "final_letter": f"Final letter for {patient_data['name']}'s appointment",
            "primary_condition": patient_data.get("encounter_summary", "")
            .split(" with ")[-1]
            .strip("."),  # Extract primary condition from summary
            "jobs_list": json.dumps(jobs_list),
            "all_jobs_completed": False,
            "encounter_summary": patient_data["encounter_summary"],
        }

        fake_patients.append(patient)

    for patient in fake_patients:
        patient_db().cursor.execute(
            """
            INSERT INTO patients (
                name, dob, ur_number, gender, encounter_date,
                template_key, template_data, raw_transcription,
                transcription_duration, process_duration,
                jobs_list, all_jobs_completed, final_letter,
                primary_condition, encounter_summary
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient["name"],
                patient["dob"],
                patient["ur_number"],
                patient["gender"],
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


if __name__ == "__main__":
    main()
