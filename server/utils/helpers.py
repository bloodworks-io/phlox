from ast import Try
from datetime import datetime
from numpy import resize
from server.utils.llm_client import (
    AsyncLLMClient,
    LLMProviderType,
    get_llm_client,
    is_thinking_model,
)
from server.schemas.patient import Patient, Condition, Summary
from server.database.config import config_manager
from server.schemas.grammars import ClinicalReasoning
import logging
import asyncio
import re
import Levenshtein
from pydantic import BaseModel
from typing import Optional, List, Union, Dict
import json
from server.database.connection import db
from server.schemas.grammars import (
    FieldResponse,
    RefinedResponse,
    NarrativeResponse,
)
from server.schemas.templates import TemplateField, TemplateResponse

# Set up module-level logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def find_best_condition_match(condition_name: str, existing_conditions: List[str], threshold: float = 0.8) -> Optional[str]:
    """
    Find the best fuzzy match for a condition name from existing conditions.

    Args:
        condition_name: The condition name to match
        existing_conditions: List of existing condition names
        threshold: Minimum similarity threshold (0.0 to 1.0)

    Returns:
        The best matching existing condition name, or None if no good match found
    """
    if not condition_name or not existing_conditions:
        return None

    # Normalize for comparison
    normalized_input = condition_name.lower().strip()

    best_match = None
    best_ratio = 0.0

    for existing in existing_conditions:
        normalized_existing = existing.lower().strip()

        # Try different similarity measures
        ratios = [
            Levenshtein.ratio(normalized_input, normalized_existing),
            # Also check if one is contained in the other (for cases like "Iron deficiency" vs "iron deficiency anaemia")
            max(
                len(normalized_input) / len(normalized_existing) if normalized_input in normalized_existing else 0,
                len(normalized_existing) / len(normalized_input) if normalized_existing in normalized_input else 0
            ) * 0.9  # Slightly lower weight for containment
        ]

        max_ratio = max(ratios)

        if max_ratio > best_ratio and max_ratio >= threshold:
            best_ratio = max_ratio
            best_match = existing

    if best_match:
        logger.info(f"Fuzzy matched '{condition_name}' to '{best_match}' (similarity: {best_ratio:.3f})")

    return best_match

def create_condition_prompt_with_constraints(existing_conditions: List[str], combined_text: str, is_secondary_thinking: bool) -> tuple[str, str]:
    """
    Create system and user prompts with condition constraints.
    """
    if not existing_conditions:
        # Fallback to original prompts
        condition_system = (
            "You are a medical AI that is skilled at extracting the primary diagnosis for a medical encounter. "
            "Return a JSON formatted string with a single field called `condition_name` that represents the primary problem "
            "according to the ICD-10 WHO classifications. "
            "Important: `condition_name` must contain only the condition itself (no descriptors such as 'recurrent', 'relapsed', 'mild', or 'bilateral', "
            "with no staging/grade/severity terms) and avoid acronyms/abbreviations (prefer full disease names)."
        )

        condition_user = (
            f"Patient note: {combined_text}. Provide the primary condition they are being treated for according to the WHO ICD-10 classification. "
            f"Do not include the ICD code. Respond only with the common name of the condition (no descriptors like 'recurrent', 'relapsed', 'mild', or 'bilateral' ). "
            f"Avoid acronyms/abbreviations—prefer the full disease name."
        )
    else:
        # Create constrained prompts with existing conditions
        display_conditions = existing_conditions[:20]  # Limit to avoid overwhelming prompt
        conditions_list = "\n".join([f"- {condition}" for condition in display_conditions])
        more_text = f"\n(and {len(existing_conditions) - 20} more)" if len(existing_conditions) > 20 else ""

        condition_system = (
            "You are a medical AI that extracts the primary diagnosis for a medical encounter. "
            "You must choose from the existing conditions in our database when possible. "
            "If the patient's condition closely matches one of the existing conditions, use that exact name including the exact letter casing. "
            "Only set is_new_condition to true if the condition is genuinely different from all existing options. "
            "The `condition_name` must contain only the condition itself (no descriptors such as 'recurrent', 'relapsed', 'mild', or 'bilateral', with no staging/grade/severity terms) "
            "and avoid acronyms/abbreviations (prefer full disease names). "
            "Return JSON with 'condition_name' and 'is_new_condition' fields."
        )

        condition_user = (
            f"Patient note: {combined_text}\n\n"
            f"Existing conditions in database:\n{conditions_list}{more_text}\n\n"
            f"Select the primary condition. If it matches an existing condition, use the exact name and letter casing from the list above. "
            f"If it's a new condition not represented in the list, provide the condition name and set is_new_condition to true. "
            f"Respond only with the condition itself (no descriptors like 'recurrent', 'relapsed', 'mild', or 'bilateral' and avoid acronyms/abbreviations—prefer full disease names."
        )

    if is_secondary_thinking:
        condition_user = f"{condition_user} /no_think"

    return condition_system, condition_user

async def summarize_encounter(patient: Patient) -> tuple[str, Optional[str]]:
    """
    Summarize a patient encounter and extract the primary condition asynchronously.

    Args:
        patient (Patient): A Patient object containing relevant encounter information.

    Returns:
        tuple[str, Optional[str]]: A tuple containing the summarized description and the extracted condition.

    Raises:
        ValueError: If DOB or Encounter Date is missing from the patient data.
    """

    config = config_manager.get_config()
    prompts = config_manager.get_prompts_and_options()
    client = get_llm_client()

    if not patient.dob or not patient.encounter_date:
        raise ValueError("DOB or Encounter Date is missing")

    template_values = []
    for field_key, field_value in patient.template_data.items():
        if field_value:
            template_values.append(field_value)

    combined_text = "\n\n".join(template_values)

    age = calculate_age(patient.dob, patient.encounter_date)
    initial_summary_content = (
        f"{age} year old {'male' if patient.gender == 'M' else 'female'} with "
    )

    summary_request_body = [
        {"role": "system", "content": prompts["prompts"]["summary"]["system"]},
        {"role": "user", "content": combined_text},
        {"role": "assistant", "content": initial_summary_content},
    ]

    is_secondary_thinking = is_thinking_model(config["SECONDARY_MODEL"])

    condition_system = (
        "You are a medical AI that is skilled at extracting the primary diagnosis for a medical encounter. "
        "Return a JSON formatted string with a single field called `condition_name` that represents the primary problem "
        "according to the ICD-10 WHO classifications. "
        "Important: `condition_name` must contain only the condition itself (no descriptors such as 'recurrent', 'relapsed', 'mild', or 'bilateral' "
        "no staging/grade/severity terms) and avoid acronyms/abbreviations (prefer full disease names)."
    )

    condition_user = (
        f"Patient note: {combined_text}. Provide the primary condition they are being treated for according to the WHO ICD-10 classification. "
        f"Do not include the ICD code. Respond only with the common name of the condition (no descriptors like 'recurrent', 'relapsed', 'mild', or 'bilateral'). "
        f"Avoid acronyms/abbreviations—prefer the full disease name."
    )

    if is_secondary_thinking:
        logger.info("Secondary thinking model detected.")
        condition_user = f"{condition_user} /no_think"

    condition_request_body = [
        {"role": "system", "content": condition_system},
        {"role": "user", "content": condition_user},
    ]

    async def fetch_summary():
        logging.info(summary_request_body)
        response_json = await client.chat_with_structured_output(
            model=config["SECONDARY_MODEL"],
            messages=summary_request_body,
            schema=Summary.model_json_schema(),
            options={**prompts["options"]["secondary"], "temperature": 0.7},
        )
        summary_response = Summary.model_validate_json(response_json)
        summary_content = summary_response.summary_text

        summary_content = clean_think_tags(summary_content)

        # Truncate at the first empty line
        summary_content = summary_content.split("\n\n")[0]
        logging.info(f"Summary content: {summary_content}")

        return initial_summary_content + summary_content



    async def fetch_condition():
        # Get existing conditions from database
        existing_conditions = db.get_unique_primary_conditions()
        logging.info(f"Found {len(existing_conditions)} existing conditions in database")

        # PASS 1: Initial condition extraction
        condition_system, condition_user = create_condition_prompt_with_constraints(
            existing_conditions, combined_text, is_secondary_thinking
        )

        condition_request_body_constrained = [
            {"role": "system", "content": condition_system},
            {"role": "user", "content": condition_user},
        ]

        # Use ConstrainedCondition schema if we have existing conditions, otherwise fallback
        schema_to_use = Condition if existing_conditions else Condition

        response_json = await client.chat_with_structured_output(
            model=config["SECONDARY_MODEL"],
            messages=condition_request_body_constrained,
            schema=schema_to_use.model_json_schema(),
            options=prompts["options"]["secondary"],
        )

        try:
            condition_response = Condition.model_validate_json(response_json)
            condition_name = condition_response.condition_name

            # Normalize: remove disallowed descriptors and canonicalize case to existing DB names
            cleaned_condition = re.sub(r"\b(recurrent|relapsed)\b", "", condition_name, flags=re.IGNORECASE)
            cleaned_condition = re.sub(r"\s+", " ", cleaned_condition).strip()

            if existing_conditions:
                # Try fuzzy matching with existing conditions to prevent duplicates
                fuzzy_match = find_best_condition_match(cleaned_condition, existing_conditions, threshold=0.85)

                if fuzzy_match:
                    cleaned_condition = fuzzy_match
                    logger.info(f"Pass 1: Using fuzzy matched condition: {fuzzy_match}")
                else:
                    # PASS 2: No good match found, try disambiguation with top candidates
                    logger.info(f"Pass 1: No good fuzzy match for '{cleaned_condition}', trying disambiguation pass")

                    # Get top 10 most similar conditions for disambiguation
                    candidates = []
                    for existing in existing_conditions:
                        similarity = Levenshtein.ratio(cleaned_condition.lower(), existing.lower())
                        candidates.append((existing, similarity))

                    # Sort by similarity and take top 10
                    candidates.sort(key=lambda x: x[1], reverse=True)
                    top_candidates = [cand[0] for cand in candidates[:10]]

                    if top_candidates:
                        candidates_list = "\n".join([f"- {cand}" for cand in top_candidates])

                        disambig_system = (
                            "You are a medical AI that selects the best matching condition from a curated list. "
                            "Choose the condition that best matches the patient's primary diagnosis. "
                            "If none of the options are appropriate, respond with 'NEW_CONDITION'. "
                            "Return JSON with 'condition_name' field containing either the exact condition name from the list or 'NEW_CONDITION'."
                        )

                        disambig_user = (
                            f"Patient note: {combined_text}\n\n"
                            f"Initial extraction suggested: '{cleaned_condition}'\n\n"
                            f"Select the best match from these similar conditions:\n{candidates_list}\n\n"
                            f"Choose the condition that best matches this patient's primary diagnosis, or respond with 'NEW_CONDITION' if none fit."
                        )

                        if is_secondary_thinking:
                            disambig_user = f"{disambig_user} /no_think"

                        disambig_request_body = [
                            {"role": "system", "content": disambig_system},
                            {"role": "user", "content": disambig_user},
                        ]

                        disambig_response_json = await client.chat_with_structured_output(
                            model=config["SECONDARY_MODEL"],
                            messages=disambig_request_body,
                            schema=Condition.model_json_schema(),
                            options=prompts["options"]["secondary"],
                        )

                        disambig_response = Condition.model_validate_json(disambig_response_json)
                        disambig_condition = disambig_response.condition_name

                        if disambig_condition != "NEW_CONDITION" and disambig_condition in top_candidates:
                            cleaned_condition = disambig_condition
                            logger.info(f"Pass 2: Disambiguation selected: {disambig_condition}")
                        else:
                            logger.info(f"Pass 2: Keeping original condition as new: {cleaned_condition}")

            if existing_conditions:
                if getattr(condition_response, "is_new_condition", False):
                    logging.info(f"New condition identified: {condition_name} -> normalized: {cleaned_condition}")
                else:
                    logging.info(f"Existing condition selected: {condition_name} -> normalized: {cleaned_condition}")
            else:
                logging.info(f"Condition (no constraints): {condition_name} -> normalized: {cleaned_condition}")

            return cleaned_condition

        except Exception as e:
            logging.error(f"Error extracting condition: {e}, response content: {response_json}")
            return None


    summary, condition = await asyncio.gather(
        fetch_summary(), fetch_condition()
    )

    return summary, condition



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

    # Create a modified schema that doesn't include the thinking field for the final response
    # We'll add it back later for Qwen models
    modified_schema = {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "differentials": {"type": "array", "items": {"type": "string"}},
            "investigations": {"type": "array", "items": {"type": "string"}},
            "clinical_considerations": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": [
            "summary",
            "differentials",
            "investigations",
            "clinical_considerations",
        ],
    }

    model_name = config["REASONING_MODEL"].lower()
    thinking = ""

    if is_thinking_model(model_name):
        logger.info(
            f"Thinking model detected: {model_name}. Getting explicit thinking step."
        )

        # First message for thinking only
        thinking_messages = [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": "<think>"},
        ]

        # Make initial call for thinking only
        thinking_options = reasoning_options.copy()
        thinking_options["stop"] = ["</think>"]

        thinking_response = await client.chat(
            model=config["REASONING_MODEL"],
            messages=thinking_messages,
            options=thinking_options,
        )

        # Extract thinking content
        thinking = thinking_response["message"]["content"]

        # Now make the structured output call with thinking included
        response = await client.chat(
            model=config["REASONING_MODEL"],
            messages=[
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": f"<think>{thinking}</think>"},
            ],
            format=modified_schema,
            options=reasoning_options,
        )

        # Create the full response with thinking included
        result_dict = json.loads(response["message"]["content"])
        result_dict["thinking"] = thinking

        # Convert to ClinicalReasoning model
        return ClinicalReasoning.model_validate(result_dict)
    else:
        # Standard approach for other models
        response = await client.chat(
            model=config["REASONING_MODEL"],
            messages=[{"role": "user", "content": prompt}],
            format=ClinicalReasoning.model_json_schema(),
            options=reasoning_options,
        )

    return ClinicalReasoning.model_validate_json(response.message.content)


def calculate_age(dob: str, encounter_date: str = None) -> int:
    """
    Calculate the age of a patient at the time of encounter or current date.

    Args:
        dob (str): Date of birth in 'YYYY-MM-DD' format.
        encounter_date (str, optional): Date of encounter in 'YYYY-MM-DD' format.
            If not provided, current date is used.

    Returns:
        int: The calculated age in years.

    Raises:
        ValueError: If DOB is missing or in an invalid format.
    """
    if not dob:
        raise ValueError("DOB is missing")

    try:
        birth_date = datetime.strptime(dob, "%Y-%m-%d")
        encounter_date_obj = (
            datetime.strptime(encounter_date, "%Y-%m-%d")
            if encounter_date
            else datetime.today()
        )
    except ValueError:
        raise ValueError("Invalid date format. Use 'YYYY-MM-DD'.")

    age = encounter_date_obj.year - birth_date.year
    if (encounter_date_obj.month, encounter_date_obj.day) < (
        birth_date.month,
        birth_date.day,
    ):
        age -= 1

    return age


async def refine_field_content(
    content: Union[str, Dict], field: TemplateField
) -> Union[str, Dict]:
    """
    Refine the content of a single field using style examples and format schema.
    Handles special case for thinking models via the client abstraction.
    """
    try:
        if isinstance(content, dict):
            return content

        config = config_manager.get_config()
        client = get_llm_client()
        prompts = config_manager.get_prompts_and_options()
        options = prompts["options"]["general"]

        # Determine format details
        format_details = determine_format_details(field, prompts)

        # Build system prompt with style example if available
        system_prompt = build_system_prompt(field, format_details, prompts)

        base_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ]

        # Always use structured output helper; it handles thinking models internally
        response_json = await client.chat_with_structured_output(
            model=config["PRIMARY_MODEL"],
            messages=base_messages,
            schema=format_details["response_format"],
            options=options,
        )

        # Reuse existing formatter by wrapping the JSON string
        pseudo_response = {"message": {"content": response_json}}
        return format_refined_response(pseudo_response, field, format_details)

    except Exception as e:
        logger.error(f"Error refining field {field.field_key}: {e}")
        raise


def determine_format_details(field: TemplateField, prompts: dict) -> dict:
    """Determine response format and format type based on field schema."""

    format_type = None
    if field.format_schema and "type" in field.format_schema:
        format_type = field.format_schema["type"]

        if format_type == "narrative":
            return {
                "format_type": "narrative",
                "response_format": NarrativeResponse.model_json_schema(),
                "base_prompt": "Format the following content as a cohesive narrative paragraph.",
            }

    # Default to RefinedResponse for non-narrative formats
    format_guidance = ""
    if format_type == "numbered":
        format_guidance = (
            "Format the key points as a numbered list (1., 2., etc.)."
        )
    elif format_type == "bullet":
        format_guidance = (
            "Format the key points as a bulleted list (•) prefixes)."
        )

    return {
        "format_type": format_type,
        "response_format": RefinedResponse.model_json_schema(),
        "base_prompt": prompts["prompts"]["refinement"]["system"],
        "format_guidance": format_guidance,
    }


def build_system_prompt(
    field: TemplateField, format_details: dict, prompts: dict
) -> str:
    """Build the system prompt using format guidance and style examples."""
    logger.info(f"Building system prompt for field: {field.field_name}")

    schema_str = json.dumps(format_details["response_format"], indent=2)

    # Check if field has style_example and prioritize it
    if hasattr(field, "style_example") and field.style_example:
        system_prompt = f"""
        You are an expert medical scribe. Your task is to reformat medical information to precisely match the style example provided, while maintaining clinical accuracy. The medical information is a summary of a patient transcript. The summary was generated by an automated system therefore it may contain irrelevant information.

        STYLE EXAMPLE:
        {field.style_example}

        FORMATTING INSTRUCTIONS:
        1. Analyze the STYLE EXAMPLE and match it EXACTLY, including:
        - Format elements (bullet style, indentation, paragraph structure)
        - Sentence structure (fragments vs. complete sentences)
        - Capitalization and punctuation patterns
        - Abbreviation conventions and medical terminology style
        - Tense (past/present) and perspective (first/third person)

        2. IMPORTANT CONSTRAINTS:
        - Preserve ALL important clinical details from the original text; information which is irrelevant to the clinical encounter should be removed.
        - Do not add information not present in the input
        - If the style example uses abbreviations like "SNT" or "HSM", use similar appropriate medical abbreviations
        - Return JSON

        FORMAT THE FOLLOWING MEDICAL INFORMATION:"""
    else:
        # If no style example, start with base prompt
        system_prompt = format_details["base_prompt"]

        # Add format guidance if available
        if (
            "format_guidance" in format_details
            and format_details["format_guidance"]
        ):
            system_prompt += "\n" + format_details["format_guidance"]

        # Apply custom refinement rules if specified and no style example exists
        if field.refinement_rules:
            for rule in field.refinement_rules:
                if rule in prompts["prompts"]["refinement"]:
                    system_prompt = prompts["prompts"]["refinement"][rule]
                    break

    # Add adaptive_refinement_instructions if they exist
    # This should be appended regardless of whether a style_example or refinement_rule was applied,
    # as they are supplementary.
    if (
        hasattr(field, "adaptive_refinement_instructions")
        and field.adaptive_refinement_instructions
    ):
        instructions_string = "\n\nAdditionally, consider these user-derived preferences to improve the output further:"
        for i, instruction in enumerate(field.adaptive_refinement_instructions):
            instructions_string += f"\n- {instruction}"
        system_prompt += instructions_string

    return system_prompt


def format_refined_response(
    response: dict, field: TemplateField, format_details: dict
) -> str:
    """Format the model response according to field requirements."""
    format_type = format_details["format_type"]

    if format_type == "narrative":
        narrative_response = NarrativeResponse.model_validate_json(
            response["message"]["content"]
        )
        return narrative_response.narrative

    # Handle non-narrative formats
    refined_response = RefinedResponse.model_validate_json(
        response["message"]["content"]
    )

    if format_type == "numbered":
        return format_numbered_list(refined_response.key_points)
    elif format_type == "bullet":
        return format_bulleted_list(refined_response.key_points, field)
    else:
        # No specific formatting required
        return "\n".join(refined_response.key_points)


def format_numbered_list(key_points: List[str]) -> str:
    """Format key points as a numbered list."""
    formatted_key_points = []
    for i, point in enumerate(key_points):
        # Strip any existing numbering
        cleaned_point = re.sub(r"^\d+\.\s*", "", point.strip())
        formatted_key_points.append(f"{i+1}. {cleaned_point}")
    return "\n".join(formatted_key_points)


def format_bulleted_list(key_points: List[str], field: TemplateField) -> str:
    """Format key points as a bulleted list."""
    bullet_char = "•"  # Default bullet character
    if field.format_schema and "bullet_char" in field.format_schema:
        bullet_char = field.format_schema["bullet_char"]

    formatted_key_points = []
    for point in key_points:
        # Strip any existing bullets
        cleaned_point = re.sub(r"^[•\-\*]\s*", "", point.strip())
        formatted_key_points.append(f"{bullet_char} {cleaned_point}")
    return "\n".join(formatted_key_points)


def clean_think_tags(message_list):
    """
    Remove <think> tags and their contents from conversation history messages.

    Args:
        message_list (list): List of message dictionaries

    Returns:
        list: Cleaned message list with <think> tags removed
    """

    # Handle simple strings
    if isinstance(message_list, str):
        return re.sub(r"<think>.*?</think>", "", message_list, flags=re.DOTALL)

    cleaned_messages = []

    for message in message_list:
        if "content" in message and isinstance(message["content"], str):
            # Remove <think>...</think> patterns from content
            cleaned_content = re.sub(
                r"<think>.*?</think>", "", message["content"], flags=re.DOTALL
            )
            # Create a new message with cleaned content
            cleaned_message = message.copy()
            cleaned_message["content"] = cleaned_content.strip()
            cleaned_messages.append(cleaned_message)
        else:
            # If no content or not a string, keep the message as is
            cleaned_messages.append(message)

    return cleaned_messages
