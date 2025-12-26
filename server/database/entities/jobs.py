import json
import logging
import traceback

from server.database.core.connection import db


def generate_jobs_list_from_plan(plan):
    """Generates a jobs list from a plan string."""
    logging.info("Generating jobs list from the plan")
    try:
        if not plan:
            return "[]"

        jobs = [
            item.strip()
            for item in plan.split("\n")
            if item.strip() and item.strip()[0].isdigit()
        ]
        jobs_list = [
            {"id": index + 1, "job": job, "completed": False}
            for index, job in enumerate(jobs)
        ]
        return json.dumps(jobs_list)
    except Exception as e:
        logging.error(f"Error generating jobs list: {e}")
        return "[]"


def are_all_jobs_completed(jobs_list):
    """Checks if all jobs in a jobs list are completed."""
    logging.info("Checking if all jobs are completed")
    try:
        if isinstance(jobs_list, str):
            jobs_list = json.loads(jobs_list)

        if not jobs_list:
            logging.info("No jobs list provided")
            return False

        return all(item.get("completed", False) for item in jobs_list)
    except (json.JSONDecodeError, AttributeError) as e:
        logging.error(f"Error checking jobs completion: {e}")
        return False


def get_patients_with_outstanding_jobs():
    """Retrieve patients with outstanding (incomplete) jobs.

    Returns:
        List[Dict]: List of patient records with outstanding jobs.
    """
    try:
        db.cursor.execute(
            """
            SELECT id, name, ur_number, dob, encounter_date,
                   encounter_summary, jobs_list, reasoning_output
            FROM patients
            WHERE all_jobs_completed = 0
            """
        )

        patients = []
        for row in db.cursor.fetchall():
            patient = dict(row)

            # Parse jobs list if it exists
            if patient.get("jobs_list"):
                try:
                    patient["jobs_list"] = json.loads(patient["jobs_list"])
                except json.JSONDecodeError:
                    patient["jobs_list"] = []

            # Process reasoning output
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
        logging.error(f"Error fetching patients with outstanding jobs: {e}")
        raise


def update_patient_jobs_list(patient_id: int, jobs_list: list):
    """Updates a patient's jobs list in the database."""
    try:
        # Need to fix this; sloppy
        serializable_jobs = []
        for job in jobs_list:
            if hasattr(job, "dict"):
                serializable_jobs.append(job.dict())
            elif hasattr(job, "__dict__"):
                serializable_jobs.append(job.__dict__)
            else:

                serializable_jobs.append(job)

        serialized_jobs_list = json.dumps(serializable_jobs)

        # Check if all jobs are completed
        all_jobs_completed = all(
            job.get("completed", False) for job in serializable_jobs
        )

        db.cursor.execute(
            "UPDATE patients SET jobs_list = ?, all_jobs_completed = ? WHERE id = ?",
            (serialized_jobs_list, all_jobs_completed, patient_id),
        )
        db.commit()
        logging.info(f"Updated jobs list for patient {patient_id}")

    except Exception as e:
        logging.error(f"Error updating jobs list: {e}")
        raise


def count_incomplete_jobs():
    """Counts the number of incomplete jobs across all patients."""
    logging.info("Counting incomplete jobs across all patients")
    try:
        db.cursor.execute(
            "SELECT jobs_list FROM patients WHERE all_jobs_completed = 0"
        )
        rows = db.cursor.fetchall()

        incomplete_jobs_count = 0

        for row in rows:
            if not row["jobs_list"]:
                continue

            try:
                jobs = json.loads(row["jobs_list"])

                # Count incomplete jobs
                incomplete_jobs_count += sum(
                    1
                    for job in jobs
                    if isinstance(job, dict) and not job.get("completed", False)
                )

            except json.JSONDecodeError:
                logging.warning(
                    f"Could not parse jobs list: {row['jobs_list']}"
                )
                continue

        logging.info(f"Total incomplete jobs: {incomplete_jobs_count}")
        return incomplete_jobs_count

    except Exception as e:
        logging.error(f"Database error when counting incomplete jobs: {e}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        raise
