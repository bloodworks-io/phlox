import json
import logging

from server.database.config import config_manager
from server.schemas.grammars import ClinicalReasoning
from server.utils.helpers import calculate_age
from server.utils.llm_client import get_llm_client

# Set up module-level logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

async def run_clinical_reasoning(
template_data: dict, dob: str, encounter_date: str, gender: str
):
    config = config_manager.get_config()
    prompts = config_manager.get_prompts_and_options()
    client = get_llm_client()

    age = calculate_age(dob, encounter_date)
    reasoning_options = prompts["options"].get("reasoning", {})
    reasoning_prompt = prompts["prompts"]["reasoning"]["system"]

    # Format the clinical note
    formatted_note = ""
    for section_name, content in template_data.items():
        if content:
            # Convert snake_case to Title Case for section names
            section_title = section_name.replace("_", " ").title()
            formatted_note += f"{section_title}:\n{content}\n\n"

    prompt = f"""{reasoning_prompt}

    Please analyze this case:

    Demographics: {age} year old {'male' if gender == 'M' else 'female'}

    Clinical Note:
    ```
    {formatted_note}
    ```

    Consider:
    1. A brief, one-sentence summary of the clinical encounter.
    2. Differential diagnoses
    3. Recommended investigations
    4. Key clinical considerations

    The key is to provide additional clinical considerations to the doctor, so feel free to take a critical eye to the clinician's perspective if appropriate."""

    response = await client.chat(
            model=config["REASONING_MODEL"],
            messages=[{"role": "user", "content": prompt}],
            format=ClinicalReasoning.model_json_schema(),
            options=reasoning_options,
        )

    content_dict = json.loads(response["message"]["content"])

    # Check if the client captured a reasoning key
    reasoning = response["message"].get("reasoning")

    # 3. Inject it into the data if present (and if not already there)
    if reasoning and "thinking" not in content_dict:
                content_dict["thinking"] = reasoning

    # 4. Validate using the modified dictionary
    return ClinicalReasoning.model_validate(content_dict)
