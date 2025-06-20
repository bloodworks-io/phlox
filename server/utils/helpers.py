from ast import Try
from datetime import datetime
from numpy import resize
from server.utils.llm_client import AsyncLLMClient, LLMProviderType, get_llm_client
from server.schemas.patient import Patient, Condition
from server.database.config import config_manager
from server.schemas.grammars import ClinicalReasoning
import logging
import asyncio
import re
from pydantic import BaseModel
from typing import Optional, List, Union, Dict
import json
from server.schemas.grammars import FieldResponse, RefinedResponse, NarrativeResponse
from server.schemas.templates import TemplateField, TemplateResponse

# Set up module-level logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

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
        f"{age} year old {'male' if patient.gender == 'M' else 'female'} with"
    )

    summary_request_body = [
        {"role": "system", "content": prompts["prompts"]["summary"]["system"]},
        {"role": "user", "content": combined_text},
        {"role": "assistant", "content": initial_summary_content},
    ]

    condition_request_body = [
        {
            "role": "system",
            "content": "You are a medical AI that is skilled at extracting the primary diagnosis for a medical encounter. You should return a JSON formatted string that has a singular field called `condition_name` that represents the primary problem according to the ICD-10 WHO classifications",
        },
        {
            "role": "user",
            "content": f"Patient note: {combined_text}. Please provide the primary condition they are being treated for according to the WHO ICD-10 classification. Please do not include the ICD code, rather, just respond with the common name of the condition.",
        },
    ]

    async def fetch_summary():

        response = await client.chat(
            model=config["SECONDARY_MODEL"],
            messages=summary_request_body,
            options=prompts["options"]["secondary"],
        )
        summary_content = response["message"]["content"]

        # Truncate at the first empty line
        summary_content = summary_content.split("\n\n")[0]
        logging.info(f"Summary content: {summary_content}")

        return initial_summary_content + summary_content

    async def fetch_condition():
        response_json = await client.chat_with_structured_output(
            model=config["SECONDARY_MODEL"],
            messages=condition_request_body,
            schema=Condition.model_json_schema(),
            options=prompts["options"]["secondary"]
        )
        try:
            condition_response = Condition.model_validate_json(response_json)
            condition_name = condition_response.condition_name
            logging.info(f"Condition: {condition_name}")
            return condition_name
        except Exception as e:
            logging.error(
                f"Error extracting condition: {e}, response content:{response_json}"
            )
            return None

    summary, condition = await asyncio.gather(
            fetch_summary(), fetch_condition()
    )

    return summary, condition

async def run_clinical_reasoning(template_data: dict, dob: str, encounter_date: str, gender: str):
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
            section_title = section_name.replace('_', ' ').title()
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

    response_json = await client.chat_with_structured_output(
        model=config["REASONING_MODEL"],
        messages=[{"role": "user", "content": prompt}],
        schema=ClinicalReasoning.model_json_schema(),
        options=reasoning_options
    )

    return ClinicalReasoning.model_validate_json(response_json)

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
    content: Union[str, Dict],
    field: TemplateField
) -> Union[str, Dict]:
    """
    Refine the content of a single field using style examples and format schema.
    Handles special case for Qwen3 models, allowing for a thinking step before structured output.

    Args:
        content (Union[str, Dict]): The raw content to refine.
        field (TemplateField): The field being processed.

    Returns:
        Union[str, Dict]: The refined content.
    """
    try:
        # If content is already structured (dict), return as is
        if isinstance(content, dict):
            return content

        # Get configuration and client
        config = config_manager.get_config()
        client = get_llm_client()
        prompts = config_manager.get_prompts_and_options()
        options = prompts["options"]["general"]

        # Determine format details
        format_details = determine_format_details(field, prompts, config["PRIMARY_MODEL"])

        # Build system prompt with style example if available
        system_prompt = build_system_prompt(field, format_details, prompts)

        base_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content}
        ]


        response_json = await client.chat_with_structured_output(
            model=config["PRIMARY_MODEL"],
            messages=base_messages,
            schema=format_details["response_format"],
            options=options
        )

        logger.info(f"Response received for field {field.field_key}: {response_json}")

        # Format the response appropriately
        return format_refined_response(response_json, field, format_details)

    except Exception as e:
        logger.error(f"Error refining field {field.field_key}: {e}")
        raise

def determine_format_details(field: TemplateField, prompts: dict, model_name: str) -> dict:
    """Determine response format and format type based on field schema."""

    format_type = None
    if field.format_schema and "type" in field.format_schema:
        format_type = field.format_schema["type"]

        if format_type == "narrative":
            return {
                "format_type": "narrative",
                "response_format": NarrativeResponse.model_json_schema(),
                "base_prompt": "Format the following content as a cohesive narrative paragraph."
            }

    # Default to RefinedResponse for non-narrative formats
    format_guidance = ""
    if format_type == "numbered":
        format_guidance = "Format the key points as a numbered list (1., 2., etc.)."
    elif format_type == "bullet":
        format_guidance = "Format the key points as a bulleted list (•) prefixes)."

    return {
        "format_type": format_type,
        "response_format": RefinedResponse.model_json_schema(),
        "base_prompt": prompts["prompts"]["refinement"]["system"],
        "format_guidance": format_guidance
    }

def build_system_prompt(field: TemplateField, format_details: dict, prompts: dict) -> str:
    """Build the system prompt using format guidance and style examples."""
    logger.info(f"Building system prompt for field: {field.field_name}")

    # Check if field has style_example and prioritize it
    if hasattr(field, 'style_example') and field.style_example:
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
        - RETURN JSON IN THE REQUESTED FORMAT
        - If the style example uses abbreviations like "SNT" or "HSM", use similar appropriate medical abbreviations

        FORMAT THE FOLLOWING MEDICAL INFORMATION:"""
    else:
        # If no style example, start with base prompt
        system_prompt = format_details["base_prompt"]

        # Add format guidance if available
        if "format_guidance" in format_details and format_details["format_guidance"]:
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
    if hasattr(field, 'adaptive_refinement_instructions') and field.adaptive_refinement_instructions:
        instructions_string = "\n\nAdditionally, consider these user-derived preferences to improve the output further:"
        for i, instruction in enumerate(field.adaptive_refinement_instructions):
            instructions_string += f"\n- {instruction}"
        system_prompt += instructions_string

    return system_prompt


def format_refined_response(response: dict, field: TemplateField, format_details: dict) -> str:
    """Format the model response according to field requirements."""
    format_type = format_details["format_type"]

    if format_type == "narrative":
        narrative_response = NarrativeResponse.model_validate_json(response)
        return narrative_response.narrative

    # Handle non-narrative formats
    refined_response = RefinedResponse.model_validate_json(response)

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
        cleaned_point = re.sub(r'^\d+\.\s*', '', point.strip())
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
        cleaned_point = re.sub(r'^[•\-\*]\s*', '', point.strip())
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
            return re.sub(r'<think>.*?</think>', '', message_list, flags=re.DOTALL)

    cleaned_messages = []

    for message in message_list:
        if "content" in message and isinstance(message["content"], str):
            # Remove <think>...</think> patterns from content
            cleaned_content = re.sub(r'<think>.*?</think>', '', message["content"], flags=re.DOTALL)
            # Create a new message with cleaned content
            cleaned_message = message.copy()
            cleaned_message["content"] = cleaned_content.strip()
            cleaned_messages.append(cleaned_message)
        else:
            # If no content or not a string, keep the message as is
            cleaned_messages.append(message)

    return cleaned_messages
