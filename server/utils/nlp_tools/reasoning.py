import json
import logging

from server.database.config.defaults.prompts import DEFAULT_PROMPTS
from server.database.config.manager import config_manager
from server.schemas.grammars import ClinicalReasoning
from server.utils.helpers import calculate_age
from server.utils.llm_client import repair_json
from server.utils.llm_client.client import get_llm_client

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
    reasoning_prompt = DEFAULT_PROMPTS["prompts"]["reasoning"]["system"]

    # Format the clinical note
    formatted_note = ""
    for section_name, content in template_data.items():
        if content:
            # Convert snake_case to Title Case for section names
            section_title = section_name.replace("_", " ").title()
            formatted_note += f"{section_title}:\n{content}\n\n"

    json_schema_instruction = (
        "Output MUST be ONLY valid JSON with top-level keys "
        '"thinking" (string), "summary" (string), '
        '"differentials" (array of objects with "suggestion", "rationale", and "critical" keys), '
        '"investigations" (array of objects with "suggestion", "rationale", and "critical" keys), '
        '"clinical_considerations" (array of objects with "suggestion", "rationale", and "critical" keys). '
        "The 'critical' field is a boolean - set to true ONLY for potentially fatal or urgent misses. "
        "Example: "
        + json.dumps(
            {
                "thinking": "...",
                "summary": "...",
                "differentials": [
                    {
                        "suggestion": "Diagnosis name",
                        "rationale": ["reason 1", "reason 2"],
                        "critical": False,
                    }
                ],
                "investigations": [
                    {
                        "suggestion": "Test name",
                        "rationale": ["reason 1"],
                        "critical": False,
                    }
                ],
                "clinical_considerations": [
                    {
                        "suggestion": "Critical consideration",
                        "rationale": ["reason 1"],
                        "critical": True,
                    }
                ],
            }
        )
    )

    prompt = f"""{reasoning_prompt}

{json_schema_instruction}

Analyze this case:

Demographics: {age} year old {'male' if gender == 'M' else 'female'}

Clinical Note:
```
{formatted_note}
```

Act as an educational peer-reviewer. Highlight potential documentation gaps and provide standard literature correlations to broaden the consideration set."""

    response = await client.chat(
        model=config["REASONING_MODEL"],
        messages=[{"role": "user", "content": prompt}],
        format=ClinicalReasoning.model_json_schema(),
        options=reasoning_options,
    )

    raw_content = response["message"]["content"]
    repaired_content = repair_json(raw_content)
    content_dict = json.loads(repaired_content)

    # Replace thinking with reasoning if present (reasoning is usually higher quality)
    reasoning = response["message"].get("reasoning")
    if reasoning:
        content_dict["thinking"] = reasoning

    # 4. Validate using the modified dictionary
    return ClinicalReasoning.model_validate(content_dict)
