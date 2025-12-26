import asyncio
import logging
import re
from typing import List, Optional

import Levenshtein

from server.database.config.manager import config_manager
from server.database.core.connection import db
from server.schemas.grammars import (
    ClinicalReasoning,
    NarrativeResponse,
    RefinedResponse,
)
from server.schemas.patient import Condition, Patient, Summary
from server.utils.helpers import calculate_age, clean_think_tags
from server.utils.llm_client import get_llm_client

# Set up module-level logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _find_best_condition_match(
    condition_name: str, existing_conditions: List[str], threshold: float = 0.8
) -> Optional[str]:
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
                (
                    len(normalized_input) / len(normalized_existing)
                    if normalized_input in normalized_existing
                    else 0
                ),
                (
                    len(normalized_existing) / len(normalized_input)
                    if normalized_existing in normalized_input
                    else 0
                ),
            )
            * 0.9,  # Slightly lower weight for containment
        ]

        max_ratio = max(ratios)

        if max_ratio > best_ratio and max_ratio >= threshold:
            best_ratio = max_ratio
            best_match = existing

    if best_match:
        logger.info(
            f"Fuzzy matched '{condition_name}' to '{best_match}' (similarity: {best_ratio:.3f})"
        )

    return best_match


def _create_condition_prompt_with_constraints(
    existing_conditions: List[str], combined_text: str
) -> tuple[str, str]:
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
        display_conditions = existing_conditions[
            :20
        ]  # Limit to avoid overwhelming prompt
        conditions_list = "\n".join(
            [f"- {condition}" for condition in display_conditions]
        )
        more_text = (
            f"\n(and {len(existing_conditions) - 20} more)"
            if len(existing_conditions) > 20
            else ""
        )

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

    return condition_system, condition_user


async def summarise_encounter(patient: Patient) -> tuple[str, Optional[str]]:
    """
    Summarise a patient encounter and extract the primary condition asynchronously.

    Args:
        patient (Patient): A Patient object containing relevant encounter information.

    Returns:
        tuple[str, Optional[str]]: A tuple containing the summarised description and the extracted condition.

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
    initial_summary_content = f"""The patient is {age} years old, and {'male' if patient.gender == 'M' else 'female'}. """

    summary_request_body = [
        {"role": "system", "content": prompts["prompts"]["summary"]["system"]},
        {"role": "user", "content": combined_text},
        {"role": "system", "content": initial_summary_content},
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
        logging.info(
            f"Found {len(existing_conditions)} existing conditions in database"
        )

        # PASS 1: Initial condition extraction
        condition_system, condition_user = (
            _create_condition_prompt_with_constraints(
                existing_conditions, combined_text
            )
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
            cleaned_condition = re.sub(
                r"\b(recurrent|relapsed)\b",
                "",
                condition_name,
                flags=re.IGNORECASE,
            )
            cleaned_condition = re.sub(r"\s+", " ", cleaned_condition).strip()

            if existing_conditions:
                # Try fuzzy matching with existing conditions to prevent duplicates
                fuzzy_match = _find_best_condition_match(
                    cleaned_condition, existing_conditions, threshold=0.85
                )

                if fuzzy_match:
                    cleaned_condition = fuzzy_match
                    logger.info(
                        f"Pass 1: Using fuzzy matched condition: {fuzzy_match}"
                    )
                else:
                    # PASS 2: No good match found, try disambiguation with top candidates
                    logger.info(
                        f"Pass 1: No good fuzzy match for '{cleaned_condition}', trying disambiguation pass"
                    )

                    # Get top 10 most similar conditions for disambiguation
                    candidates = []
                    for existing in existing_conditions:
                        similarity = Levenshtein.ratio(
                            cleaned_condition.lower(), existing.lower()
                        )
                        candidates.append((existing, similarity))

                    # Sort by similarity and take top 10
                    candidates.sort(key=lambda x: x[1], reverse=True)
                    top_candidates = [cand[0] for cand in candidates[:10]]

                    if top_candidates:
                        candidates_list = "\n".join(
                            [f"- {cand}" for cand in top_candidates]
                        )

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

                        disambig_request_body = [
                            {"role": "system", "content": disambig_system},
                            {"role": "user", "content": disambig_user},
                        ]

                        disambig_response_json = (
                            await client.chat_with_structured_output(
                                model=config["SECONDARY_MODEL"],
                                messages=disambig_request_body,
                                schema=Condition.model_json_schema(),
                                options=prompts["options"]["secondary"],
                            )
                        )

                        disambig_response = Condition.model_validate_json(
                            disambig_response_json
                        )
                        disambig_condition = disambig_response.condition_name

                        if (
                            disambig_condition != "NEW_CONDITION"
                            and disambig_condition in top_candidates
                        ):
                            cleaned_condition = disambig_condition
                            logger.info(
                                f"Pass 2: Disambiguation selected: {disambig_condition}"
                            )
                        else:
                            logger.info(
                                f"Pass 2: Keeping original condition as new: {cleaned_condition}"
                            )

            if existing_conditions:
                if getattr(condition_response, "is_new_condition", False):
                    logging.info(
                        f"New condition identified: {condition_name} -> normalized: {cleaned_condition}"
                    )
                else:
                    logging.info(
                        f"Existing condition selected: {condition_name} -> normalized: {cleaned_condition}"
                    )
            else:
                logging.info(
                    f"Condition (no constraints): {condition_name} -> normalized: {cleaned_condition}"
                )

            return cleaned_condition

        except Exception as e:
            logging.error(
                f"Error extracting condition: {e}, response content: {response_json}"
            )
            return None

    summary, condition = await asyncio.gather(
        fetch_summary(), fetch_condition()
    )

    return summary, condition
