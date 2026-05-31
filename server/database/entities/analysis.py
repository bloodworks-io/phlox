import json
import logging
from datetime import datetime

from server.database.config.manager import config_manager
from server.schemas.grammars import PreviousVisitSummary
from server.utils.llm_client.client import get_llm_client

logger = logging.getLogger(__name__)


async def generate_previous_visit_summary(patient_data):
    """
    Generate a summary of patient's previous visit using LLM.
    """
    config = config_manager.get_config()
    client = get_llm_client()
    model = config["SECONDARY_MODEL"]
    options = config_manager.get_prompts_and_options()["options"]["secondary"]

    # Calculate time since last visit
    last_visit_date = datetime.strptime(patient_data["encounter_date"], "%Y-%m-%d")
    today = datetime.now()
    days_ago = (today - last_visit_date).days

    # Format template data into a clean text block
    note_text = ""
    if "template_data" in patient_data:
        for key, value in patient_data["template_data"].items():
            if key != "plan" and value:  # Skip plan field as we'll use jobs_list
                # Remove markdown headers and clean up the text
                cleaned_value = value.replace("#", "").strip()
                note_text += f"{key.replace('_', ' ').title()}:\n{cleaned_value}\n\n"

    # Parse jobs list into readable format
    formatted_jobs = "No jobs listed"
    try:
        jobs_list = json.loads(patient_data["jobs_list"])
        if isinstance(jobs_list, list):
            formatted_jobs = "\n".join([job["job"] for job in jobs_list])
        else:
            logger.warning(f"jobs_list is not a list: {jobs_list}")
    except (json.JSONDecodeError, TypeError) as e:
        logger.error(f"Error parsing jobs_list: {e}. jobs_list: {patient_data.get('jobs_list')}")

    # Fetch user settings
    user_settings = config_manager.get_user_settings()
    specialty = user_settings.get("specialty", "medical")

    # JSON schema instruction for flaky endpoints
    json_schema_instruction = (
        "Output MUST be ONLY valid JSON with top-level key "
        '"summary" (string). Example: ' + json.dumps({"summary": "..."})
    )

    system_prompt = f"""You are a medical assistant summarizing a recent patient visit for the doctor, a {specialty} specialist. The doctor is about to see the patient again for a follow-up. Keep your summary concise and focused on key clinical findings and outstanding investigations, but maintain a friendly tone

    {json_schema_instruction}"""

    user_prompt = f"""Briefly summarize in 2-3 sentences what happened in this patient's visit {days_ago} days ago. For example, tests that were ordered and what the key findings were. Focus on the key clinical findings and outstanding tasks from the last review with the patient.

    Patient Data:
    Patient Name (Last, First): {patient_data["name"]}
    Encounter Summary: {patient_data["encounter_summary"]}

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

        previous_visit_summary = PreviousVisitSummary.model_validate_json(response_json)
        return previous_visit_summary.summary
    except Exception as e:
        logger.error(f"Error generating previous visit summary: {e}")
        raise
