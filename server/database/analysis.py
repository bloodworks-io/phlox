import asyncio
import json
import logging
import random
from datetime import datetime, timedelta

from server.database.config import config_manager
from server.database.connection import db
from server.database.patient import get_patients_by_date
from server.schemas.grammars import PatientAnalysis, PreviousVisitSummary
from server.utils.llm_client.client import get_llm_client
from server.utils.nlp_tools.reasoning import run_clinical_reasoning

logger = logging.getLogger(__name__)


async def _generate_analysis_with_llm(patient_data):
    """
    Generate analysis using LLM.
    """
    config = config_manager.get_config()
    client = get_llm_client()
    model = config["PRIMARY_MODEL"]
    options = config_manager.get_prompts_and_options()["options"]["general"]

    today = datetime.now().strftime("%Y-%m-%d")

    # Fetch user settings (doctor's name and specialty)
    user_settings = config_manager.get_user_settings()
    doctor_name = user_settings.get("name", "")
    specialty = user_settings.get("specialty", "")

    # Build doctor context
    doctor_context = "You are a clinical practice manager assistant"
    if doctor_name and specialty:
        doctor_context += f" for {doctor_name}, a {specialty} specialist"
    elif doctor_name:
        doctor_context += f" for {doctor_name}"
    elif specialty:
        doctor_context += f" for a {specialty} specialist"

    system_prompt = f"""{doctor_context}. Today's date is {today}. Your task is to analyze patient records with outstanding tasks and provide a prioritized analysis of what needs attention. Consider the recency of encounters and the nature of outstanding tasks when determining urgency. Focus on tasks that the doctor will need to arrange once the patient leaves the rooms (such as ordering CT scans). Names are formatted as Last, First. Please just use the patient's last name. Avoid use of markdown or other formatting"""

    user_content = f"""Please analyze these patients with outstanding tasks and provide a narrative digest, in just 1 short paragraph of 3-4 sentences, of the most pressing tasks that need to be completed.

    Patient Data:
    {json.dumps(patient_data, indent=2)}"""

    initial_assistant_content = """Hi there Doctor, here's todays digest:"""

    # Create response format schema
    base_schema = PatientAnalysis.model_json_schema()

    request_body = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": initial_assistant_content},
    ]

    # Generate analysis with structured output
    response_json = await client.chat_with_structured_output(
        model=model, messages=request_body, schema=base_schema, options=options
    )

    # Parse the JSON response
    analysis_content = PatientAnalysis.model_validate_json(response_json)
    return analysis_content.analysis


async def generate_daily_analysis(force=False):
    """
    Generate analysis of outstanding patient jobs.

    Args:
        force (bool): If True, bypasses the 24-hour check and generates a new analysis
    """
    try:
        # Get the latest analysis
        db.cursor.execute(
            """
            SELECT created_at FROM daily_analysis
            ORDER BY created_at DESC LIMIT 1
        """
        )
        last_analysis = db.cursor.fetchone()

        # Check if we need to run a new analysis (skip if force=True)
        now = datetime.now()
        if not force and last_analysis:
            last_analysis_time = datetime.fromisoformat(
                last_analysis["created_at"]
            )
            if (now - last_analysis_time) < timedelta(hours=24):
                logger.info(
                    "Skipping analysis - less than 24 hours since last analysis"
                )
                return False

        # Get patients with outstanding jobs
        db.cursor.execute(
            """
            SELECT name, encounter_date, encounter_summary, jobs_list
            FROM patients
            WHERE all_jobs_completed = 0
            ORDER BY encounter_date DESC
        """
        )
        patients = db.cursor.fetchall()

        if not patients:
            logger.info("No patients with outstanding tasks found")
            return False

        # Prepare data for LLM
        patient_data = []
        for patient in patients:
            outstanding_jobs = [
                job["job"]
                for job in json.loads(patient["jobs_list"])
                if not job["completed"]
            ]

            if (
                outstanding_jobs
            ):  # Only include patients with actual outstanding jobs
                patient_data.append(
                    {
                        "name": patient["name"],
                        "date": patient["encounter_date"],
                        "summary": patient["encounter_summary"],
                        "outstanding_jobs": outstanding_jobs,
                    }
                )

        if not patient_data:
            logger.info("No outstanding tasks found after filtering")
            return False

        # Get analysis from LLM
        analysis = await _generate_analysis_with_llm(patient_data)

        # Store the analysis
        db.cursor.execute(
            """
            INSERT INTO daily_analysis (analysis_text, created_at)
            VALUES (?, ?)
        """,
            (analysis, now.isoformat()),
        )
        db.commit()

        logger.info("Successfully generated and stored new analysis")
        return True

    except Exception as e:
        logger.error(f"Error in generate_daily_analysis: {e}")
        return False


def get_latest_analysis():
    """Retrieve the most recent analysis."""
    try:
        db.cursor.execute(
            """
            SELECT analysis_text, created_at
            FROM daily_analysis
            ORDER BY created_at DESC
            LIMIT 1
        """
        )
        result = db.cursor.fetchone()
        if result:
            return {
                "analysis": result["analysis_text"],
                "generated_at": result["created_at"],
            }
        return None
    except Exception as e:
        logger.error(f"Error fetching latest analysis: {e}")
        return None


async def generate_previous_visit_summary(patient_data):
    """
    Generate a summary of patient's previous visit using LLM.
    """
    config = config_manager.get_config()
    client = get_llm_client()
    model = config["SECONDARY_MODEL"]
    options = config_manager.get_prompts_and_options()["options"]["secondary"]

    # Calculate time since last visit
    last_visit_date = datetime.strptime(
        patient_data["encounter_date"], "%Y-%m-%d"
    )
    today = datetime.now()
    days_ago = (today - last_visit_date).days

    # Format template data into a clean text block
    note_text = ""
    if "template_data" in patient_data:
        for key, value in patient_data["template_data"].items():
            if (
                key != "plan" and value
            ):  # Skip plan field as we'll use jobs_list
                # Remove markdown headers and clean up the text
                cleaned_value = value.replace("#", "").strip()
                note_text += (
                    f"{key.replace('_', ' ').title()}:\n{cleaned_value}\n\n"
                )

    # Parse jobs list into readable format
    formatted_jobs = "No jobs listed"
    try:
        jobs_list = json.loads(patient_data["jobs_list"])
        if isinstance(jobs_list, list):
            formatted_jobs = "\n".join([job["job"] for job in jobs_list])
        else:
            logger.warning(f"jobs_list is not a list: {jobs_list}")
    except (json.JSONDecodeError, TypeError) as e:
        logger.error(
            f"Error parsing jobs_list: {e}. jobs_list: {patient_data.get('jobs_list')}"
        )

    # Fetch user settings
    user_settings = config_manager.get_user_settings()
    specialty = user_settings.get("specialty", "medical")

    system_prompt = f"""You are a medical assistant summarizing a recent patient visit for the doctor, a {specialty} specialist. The doctor is about to see the patient again for a follow-up. Keep your summary concise and focused on key clinical findings and outstanding investigations, but maintain a friendly tone"""

    user_prompt = f"""Briefly summarize in 2-3 sentences what happened in this patient's visit {days_ago} days ago. For example, tests that were ordered and what the key findings were. Focus on the key clinical findings and outstanding tasks from the last review with the patient.

    Patient Data:
    Patient Name (Last, First): {patient_data['name']}
    Encounter Summary: {patient_data['encounter_summary']}

    Clinical Note:
    {note_text}

    Outstanding Tasks:
    {formatted_jobs}"""

    # Base schema (no thinking field)
    base_schema = PreviousVisitSummary.model_json_schema()

    request_body = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        response_json = await client.chat_with_structured_output(
            model=model,
            messages=request_body,
            schema=base_schema,
            options=options,
        )

        previous_visit_summary = PreviousVisitSummary.model_validate_json(
            response_json
        )
        return previous_visit_summary.summary
    except Exception as e:
        logger.error(f"Error generating previous visit summary: {e}")
        raise


async def run_nightly_reasoning():
    """Run reasoning analysis on patients from yesterday and today."""
    logging.info("Starting nightly reasoning job")

    if not config_manager.get_config().get("REASONING_ENABLED", False):
        logging.info("Reasoning analysis is disabled")
        return

    try:
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        patients = get_patients_by_date(
            yesterday, include_data=True
        ) + get_patients_by_date(today, include_data=True)
        logging.info(
            f"Found {len(patients)} patients to process for dates {yesterday} and {today}"
        )

        patients_to_process = [
            patient
            for patient in patients
            if not patient.get("reasoning_output")
            and patient.get("template_data")
        ]

        if not patients_to_process:
            logging.info("No patients need reasoning analysis")
            return

        MAX_CONCURRENT_REQUESTS = 5
        sem = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

        async def process_patient(patient):
            patient_id = patient["id"]
            async with sem:
                try:
                    reasoning_output = await run_clinical_reasoning(
                        patient["template_data"],
                        patient["dob"],
                        patient["encounter_date"],
                        patient["gender"],
                    )
                    return {
                        "patient_id": patient_id,
                        "success": True,
                        "reasoning": reasoning_output,
                    }
                except Exception as e:
                    logging.error(
                        f"Error processing reasoning for patient {patient_id}: {str(e)}"
                    )
                    return {
                        "patient_id": patient_id,
                        "success": False,
                        "error": str(e),
                    }

        results = await asyncio.gather(
            *[process_patient(patient) for patient in patients_to_process]
        )

        successful_updates = 0
        failed_updates = 0

        for result in results:
            patient_id = result["patient_id"]
            if result["success"]:
                try:
                    db.cursor.execute(
                        "UPDATE patients SET reasoning_output = ? WHERE id = ?",
                        (json.dumps(result["reasoning"].dict()), patient_id),
                    )
                    successful_updates += 1
                except Exception as e:
                    failed_updates += 1
                    logging.error(
                        f"Database update failed for patient {patient_id}: {str(e)}"
                    )
            else:
                failed_updates += 1

        try:
            db.commit()
        except Exception as e:
            logging.error(f"Error committing database updates: {str(e)}")
            raise

        total_processed = len(patients_to_process)
        logging.info(
            f"Nightly reasoning completed. "
            f"Processed {total_processed} patients: "
            f"{successful_updates} successful, {failed_updates} failed"
        )

    except Exception as e:
        logging.error(f"Fatal error in nightly reasoning job: {str(e)}")
        raise
