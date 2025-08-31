import aiohttp
import asyncio
import logging
import json
from server.utils.llm_client import (
    AsyncLLMClient,
    LLMProviderType,
    get_llm_client,
)
from server.database.config import config_manager
from server.utils.helpers import calculate_age, refine_field_content
from server.schemas.templates import TemplateResponse
from server.schemas.grammars import FieldResponse
import fitz  # PyMuPDF for PDF processing
import io
import pytesseract
from PIL import Image
import numpy as np
from typing import Dict, List, Optional, Tuple, Any

# Set up module-level logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

async def process_document_content(
    document_buffer: bytes,
    content_type: str,
    name: Optional[str] = None,
    dob: Optional[str] = None,
    gender: Optional[str] = None
) -> Tuple[str, str, str]:
    """
    Process document content using OCR first, then pass the extracted text to the LLM.

    This function handles both images and PDFs, extracting text and analyzing it to
    generate structured medical information.

    Args:
        document_buffer: Binary content of the document
        content_type: MIME type of the document
        name: Patient name, if available
        dob: Patient date of birth, if available
        gender: Patient gender, if available

    Returns:
        Tuple containing primary_history, additional_history, and investigations

    Raises:
        Exception: If processing fails
    """
    config = config_manager.get_config()
    prompts = config_manager.get_prompts_and_options()
    options = prompts["options"]["general"].copy()
    del options["stop"]

    # Extract text from document using OCR
    extracted_text = await extract_text_from_document(
        document_buffer, content_type
    )

    # Prepare patient context
    patient_context = _build_patient_context(name, dob, gender)

    async def process_section(section_type: str, system_prompt: str) -> str:
        """
        Process a specific section of the medical document using LLM.

        Args:
            section_type: Type of section to extract
            system_prompt: System prompt for the LLM

        Returns:
            Extracted and formatted content for the section
        """
        client = get_llm_client()
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Please analyze this medical document text and provide the {section_type} summary:\n\n{extracted_text}",
            },
            {
                "role": "assistant",
                "content": f"{section_type}:\n",
            },
        ]

        logger.debug(f"Processing {section_type} with LLM")
        response = await client.chat(
            model=config["PRIMARY_MODEL"],
            messages=messages,
            options=options,
        )
        return response["message"]["content"]

    # Define prompts for each section
    prompts = {
        "Primary History": """You are a medical documentation assistant. Review this medical document text and extract the 'Primary History' defined as the main reason the patient has been referred to the specialist with relevant details. Format as:
        # [Condition that has been referred]
        - [Key detail]
        - [Key detail]""",
        "Additional History": """Extract any additional medical conditions not covered in the primary history. Format as:
        # [Condition]
        - [Key detail]""",
        "Medications": """Extract all medications mentioned in the document. Format as:
        - [Medication name, dose, frequency]""",
        "Social History": """Extract all social history details; include relevant family medical history, alcohol, and smoking status. Format as:
        - [Social history detail]""",
        "Investigations": """Extract any test results or investigations mentioned; focusing on the items most relevant to the primary condition in the referral. Format as:
        - [Investigation/test result]""",
    }

    # Process all sections concurrently
    try:
        logger.info("Starting concurrent processing of document sections")
        results = await asyncio.gather(
            *[
                process_section(section, prompt)
                for section, prompt in prompts.items()
            ]
        )

        # Combine results
        primary_history = results[0]
        primary_history = "# " + primary_history.split("#", 1)[-1].strip()

        # Combine Additional History, Medications, and Social History
        additional_history = results[1]
        additional_history = (
            "# " + additional_history.split("#", 1)[-1].strip() + "\n\n"
        )
        additional_history += "Medications:\n" + results[2].strip() + "\n\n"
        additional_history += "Social History:\n" + results[3].strip()

        investigations = results[4]
        investigations = "- " + investigations.split("-", 1)[-1].strip()

        logger.info("Successfully processed all document sections")
        return primary_history, additional_history, investigations

    except Exception as e:
        logger.error(f"Error processing document sections: {str(e)}")
        raise


async def extract_text_from_document(document_buffer: bytes, content_type: str) -> str:
    """
    Extract text from document using OCR or return raw text.

    Args:
        document_buffer: Binary content of the document
        content_type: MIME type of the document

    Returns:
        Extracted text from the document
    """
    logger.info(f"Extracting text from document with content type: {content_type}")

    # If content type is text, return the text directly
    if content_type in ["text/plain", "text/html"]:
        if isinstance(document_buffer, bytes):
            return document_buffer.decode("utf-8")
        return document_buffer

    extracted_texts = []

    if content_type == "application/pdf":
        # Handle PDF
        logger.debug("Processing PDF document with PyMuPDF")
        pdf_document = fitz.open(stream=document_buffer, filetype="pdf")
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]
            pix = page.get_pixmap()
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            text = pytesseract.image_to_string(img)
            extracted_texts.append(text)
            logger.debug(f"Extracted text from PDF page {page_num+1}/{pdf_document.page_count}")
    else:
        # Handle single image
        logger.debug("Processing image document with Tesseract OCR")
        img = Image.open(io.BytesIO(document_buffer))
        text = pytesseract.image_to_string(img)
        extracted_texts.append(text)

    return "\n\n".join(extracted_texts)


async def process_document_with_template(
    document_buffer: bytes,
    content_type: str,
    template_fields: List[Any],
    patient_context: Dict[str, Any]
) -> Dict[str, str]:
    """
    Process document content and extract information to fill template fields.

    Args:
        document_buffer: Binary content of the document
        content_type: MIME type of the document
        template_fields: List of template field definitions
        patient_context: Dictionary containing patient information

    Returns:
        Dictionary mapping field keys to extracted content
    """
    logger.info(f"Processing document with template containing {len(template_fields) if template_fields else 0} fields")

    config = config_manager.get_config()
    prompts = config_manager.get_prompts_and_options()
    options = prompts["options"]["general"].copy()

    # Extract text from document using OCR
    logging.info("Extracting text from document")
    extracted_text = await extract_text_from_document(
        document_buffer, content_type
    )

    # If there are no template fields, use the old method for backward compatibility
    if not template_fields:
        logger.info("No template fields provided, using legacy processing method")
        primary_history, additional_history, investigations = (
            await process_document_content(
                document_buffer,
                content_type,
                patient_context.get('name'),
                patient_context.get('dob'),
                patient_context.get('gender')
            )
        )

        # Return a basic set of fields (this is used for backward compatibility)
        return {
            "primary_history": primary_history,
            "additional_history": additional_history,
            "investigations": investigations
        }

    try:
        # Process all template fields concurrently
        raw_results = await asyncio.gather(*[
            process_document_field(
                extracted_text,
                field,
                patient_context
            )
            for field in template_fields
        ])

        # Refine all results concurrently
        refined_results = await asyncio.gather(*[
            refine_field_content(
                result.content,
                field
            )
            for result, field in zip(raw_results, template_fields)
        ])

        # Combine results into a dictionary
        results = {
            field.field_key: refined_content
            for field, refined_content in zip(template_fields, refined_results)
        }

        logger.info(f"Successfully processed {len(results)} template fields")
        return results

    except Exception as e:
        logger.error(f"Error processing document with template: {str(e)}")
        raise


async def process_document_field(
    document_text: str,
    field: Any,
    patient_context: Dict[str, Any]
) -> TemplateResponse:
    """Process a single document field by extracting key points from the document text.

    Args:
        document_text (str): The extracted text from the document to be analyzed.
        field (Any): The template field configuration containing prompts.
        patient_context (Dict[str, Any]): Patient context details.

    Returns:
        TemplateResponse: An object containing the field key and the formatted key points.
    """
    try:
        config = config_manager.get_config()
        client = get_llm_client()
        options = config_manager.get_prompts_and_options()["options"]["general"].copy()

        # Use FieldResponse for structured output
        response_format = FieldResponse.model_json_schema()

        # Get the field name and system prompt
        field_name = field.field_name
        system_prompt = getattr(field, 'system_prompt', "") or ""

        # If no system prompt is provided, create a default one
        if not system_prompt:
            system_prompt = f"You are a medical documentation assistant. Extract the {field_name} from the provided medical document."

        # Build patient context for the prompt
        context_str = ""
        if patient_context:
            # Convert dictionary to format expected by _build_patient_context
            context_str = _build_patient_context(
                patient_context.get('name'),
                patient_context.get('dob'),
                patient_context.get('gender')
            )

        # Create the request messages
        request_body = [
            {"role": "system", "content": (
                f"{system_prompt}\n"
                "Extract and return key points as a JSON array."
            )},
        ]

        # Add patient context if available
        if context_str:
            request_body.append({"role": "system", "content": f"Patient context: {context_str}"})

        # Add the document text as user input
        request_body.append({"role": "user", "content": f"Please extract the {field_name} from this medical document:\n\n{document_text}"})

        logger.info(f"Processing document field: {field_name}")

        # Set temperature to 0 for deterministic output
        options["temperature"] = 0

        # Make the API call
        response = await client.chat(
            model=config["PRIMARY_MODEL"],
            messages=request_body,
            format=response_format,
            options=options
        )

        # Parse the response
        field_response = FieldResponse.model_validate_json(
            response['message']['content']
        )

        # Convert key points into a formatted string
        formatted_content = "\n".join(f"• {point.strip()}" for point in field_response.key_points)

        return TemplateResponse(
            field_key=field.field_key,
            content=formatted_content
        )

    except Exception as e:
        logger.error(f"Error processing document field {field.field_key}: {e}")
        # Return empty result on error
        return TemplateResponse(
            field_key=field.field_key,
            content=f"Error extracting {field.field_name}: {str(e)}"
        )

def _build_patient_context(name: Optional[str], dob: Optional[str], gender: Optional[str]) -> str:
    """
    Build context string from patient details.

    Args:
        name: Patient name
        dob: Patient date of birth
        gender: Patient gender ('M' or 'F')

    Returns:
        Formatted string with patient context
    """
    context_parts = []
    if name:
        context_parts.append(f"Patient: {name}")
    if dob:
        age = calculate_age(dob)
        context_parts.append(f"Age: {age}")
    if gender:
        context_parts.append(f"Gender: {'Male' if gender == 'M' else 'Female'}")
    return " | ".join(context_parts)


def _parse_model_output(output: str) -> Tuple[str, str, str]:
    """
    Parse the model output into separate sections.

    Args:
        output: Raw output from the LLM

    Returns:
        Tuple containing (primary_history, additional_history, investigations)
    """
    # Prepend the section headers that were removed
    full_output = f"Primary History:\n#{output}"

    sections = full_output.split("\n\n")
    primary_history = ""
    additional_history = ""
    investigations = ""

    current_section = None
    for section in sections:
        if section.startswith("Primary History:"):
            current_section = "primary"
            primary_history = section.replace("Primary History:", "").strip()
        elif section.startswith("Additional History:"):
            current_section = "additional"
            additional_history = section.replace(
                "Additional History:", ""
            ).strip()
        elif section.startswith("Investigations:"):
            current_section = "investigations"
            investigations = section.replace("Investigations:", "").strip()

    return primary_history, additional_history, investigations
