import json
import logging

from server.database.config.manager import config_manager
from server.llm_client.client import get_llm_client
from server.schemas.grammars import JobExtractionResult

JSON_SCHEMA_INSTRUCTION = (
    "Output MUST be ONLY valid JSON with top-level keys "
    '"action_items" and "excluded" (each an array of objects with "text" string, '
    '"category" one of "action"/"follow_up", optional "rationale" string). Example: '
    + json.dumps(
        {
            "action_items": [{"text": "Book PET scan", "category": "action"}],
            "excluded": [{"text": "Review in clinic in 4 weeks", "category": "follow_up"}],
        }
    )
)


async def extract_jobs_from_plan(plan: str) -> JobExtractionResult:
    """Extract curated, actionable jobs from an encounter plan."""
    try:
        config = config_manager.get_config()
        prompts = config_manager.get_prompts_and_options()
        client = get_llm_client()

        system_prompt = prompts["prompts"]["job_extraction"]["system"]
        system_content = system_prompt + "\n\n" + JSON_SCHEMA_INSTRUCTION

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": plan or ""},
        ]

        response_json = await client.chat_with_structured_output(
            model=config["SECONDARY_MODEL"],
            messages=messages,
            schema=JobExtractionResult.model_json_schema(),
            options={**prompts["options"]["secondary"], "temperature": 0.3},
        )

        return JobExtractionResult.model_validate_json(response_json)

    except Exception as e:
        logging.error(f"Error extracting jobs from plan: {e}")
        return JobExtractionResult(action_items=[], excluded=[])
