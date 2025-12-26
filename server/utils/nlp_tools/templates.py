import json
import logging
import re
from datetime import datetime

from server.database.config import config_manager
from server.database.defaults.templates import DefaultTemplates
from server.database.templates import template_exists
from server.schemas.templates import (
    ClinicalTemplate,
    ExtractedTemplate,
    FormatStyle,
    TemplateField,
)
from server.utils.llm_client.client import get_llm_client

# Set up module-level logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


async def generate_template_from_note(example_note: str) -> ClinicalTemplate:
    """
    Analyzes an example note using LLM and generates a structured ClinicalTemplate.
    Extracts formatting patterns and appropriate section starters.
    """
    try:
        config = config_manager.get_config()
        options = config_manager.get_prompts_and_options()["options"]["general"]

        client = get_llm_client()
        model_name = config["PRIMARY_MODEL"].lower()

        system_prompt = """
        You are a medical documentation expert that analyzes clinical notes and creates structured templates.
        For each section:
        1. Determine the format style (bullets, numbered, narrative, etc)
        2. Identify the exact bullet/numbering pattern used (-, 1., •, *, etc), if any
        3. Create an appropriate section starter that matches the format (include heading and initial format marker if any)
        4. Extract the section text from the example note verbatim to serve as a style example

        Each section should clearly indicate:
        - field_name (e.g., "History of Present Illness")
        - format_style (one of: bullets, numbered, narrative, heading_with_bullets, lab_values)
        - bullet_type (e.g., "-", "•", "*") if format uses bullets
        - section_starter (e.g., "HPI:\n-")
        - example_text (the actual text from the note for this section)
        """

        base_messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Analyze this clinical note and extract template sections with their format patterns. Return as JSON.Do not include any tab characters, extra whitespace, or formatting characters. Your response should be compact JSON without pretty-printing.\n\n{example_note}",
            },
        ]

        # Set up response format for structured output
        base_schema = ExtractedTemplate.model_json_schema()

        # Generate the template analysis with structured output
        response_json = await client.chat_with_structured_output(
            model=config["PRIMARY_MODEL"],
            messages=base_messages,
            schema=base_schema,
            options=options,
        )

        extracted = ExtractedTemplate.model_validate_json(response_json)

        # Convert extracted sections to TemplateField objects
        template_fields = []

        # Add all extracted sections except plan
        for section in extracted.sections:
            field_key = generate_field_key(section.field_name)
            if field_key != "plan":
                # Create format_schema based on format_style
                format_schema = None
                if section.format_style == FormatStyle.BULLETS:
                    format_schema = {
                        "type": "bullet",
                        "bullet_char": section.bullet_type or "-",
                    }
                elif section.format_style == FormatStyle.NUMBERED:
                    format_schema = {"type": "numbered"}
                elif section.format_style == FormatStyle.HEADING_WITH_BULLETS:
                    format_schema = {
                        "type": "heading_with_bullets",
                        "bullet_char": section.bullet_type or "-",
                    }

                field = TemplateField(
                    field_key=field_key,
                    field_name=section.field_name,
                    field_type="text",
                    required=section.required,
                    persistent=section.persistent,
                    system_prompt=f"Provide information for {section.field_name} using {section.format_style.value} format.",
                    style_example=section.example_text,  # Use example text
                    format_schema=format_schema,
                    refinement_rules=["default"],  # Deprecated
                )
                template_fields.append(field)

        # Update plan field's style example
        plan_section = next(
            (
                s
                for s in extracted.sections
                if generate_field_key(s.field_name) == "plan"
            ),
            None,
        )

        plan_field = DefaultTemplates.get_plan_field()
        if plan_section:
            # Extract the example text and ensure it's in numbered format
            plan_example = plan_section.example_text

            # Check if the example is already in a numbered format
            if not re.match(r"^\s*\d+\.", plan_example.lstrip()):
                # Convert to numbered format if it's not already
                lines = [
                    line.strip()
                    for line in plan_example.split("\n")
                    if line.strip()
                ]
                plan_example = "\n".join(
                    f"{i+1}. {line.lstrip('- •*').strip()}"
                    for i, line in enumerate(lines)
                )

            plan_field["style_example"] = plan_example
            plan_field["format_schema"] = {"type": "numbered"}

        template_fields.append(TemplateField(**plan_field))

        # Generate a unique template key based on the suggested name
        new_template_key = generate_unique_template_key(
            extracted.suggested_name
        )

        template = ClinicalTemplate(
            template_key=new_template_key,
            template_name=extracted.suggested_name,
            fields=template_fields,
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
        )

        return template

    except Exception as e:
        logging.error(f"Error generating template from note: {e}")
        raise


def generate_field_key(field_name: str) -> str:
    """Generate a standardized field key from a field name."""
    return field_name.lower().strip().replace(" ", "_")


def generate_unique_template_key(base_name: str) -> str:
    """
    Generate a unique template key based on the template name.
    If base name already exists, append -a, -b, -c etc.
    All template keys will have _1 appended as initial version.

    Args:
        base_name: The suggested template name to base the key on

    Returns:
        str: A unique template key with version number
    """
    base_key = generate_field_key(base_name)
    version = "_1"  # Initial version number

    # First try without any suffix
    if not template_exists(f"{base_key}{version}"):
        return f"{base_key}{version}"

    # If exists, try with suffixes -a through -z
    for suffix in (chr(i) for i in range(97, 123)):  # a through z
        test_key = f"{base_key}-{suffix}{version}"
        if not template_exists(test_key):
            return test_key

    # If we somehow run out of letters, add timestamp
    return f"{base_key}-{int(time.time())}{version}"
