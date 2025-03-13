import aiohttp
import asyncio
import logging
from ollama import AsyncClient as AsyncOllamaClient
from server.database.config import config_manager
from server.utils.helpers import calculate_age
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
        client = AsyncOllamaClient(host=config["OLLAMA_BASE_URL"])
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
    del options["stop"]

    # Extract text from document using OCR
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

    # Process each template field
    results = {}
    client = AsyncOllamaClient(host=config["OLLAMA_BASE_URL"])

    for field in template_fields:
        try:
            # Access the field attributes directly, not using get()
            field_name = field.field_name
            field_key = field.field_key


            # Handle system_prompt - use empty string as default if not present
            system_prompt = ""
            if hasattr(field, 'system_prompt'):
                system_prompt = field.system_prompt or ""

            # If no system prompt is provided, create a default one
            if not system_prompt:
                system_prompt = f"You are a medical documentation assistant. Extract the {field_name} from the provided medical document."

            # Add formatting guidance if available
            format_instructions = ""
            if hasattr(field, 'format_schema') and field.format_schema:

                format_type = field.format_schema.get('type')
                if format_type == 'bullet':
                    bullet_char = field.format_schema.get('bullet_char', '-')
                    format_instructions = f"\nFormat the response as a bullet list using '{bullet_char}' as the bullet character."
                elif format_type == 'numbered':
                    format_instructions = "\nFormat the response as a numbered list."

            system_prompt += format_instructions

            logger.info(f"Processing template field: {field_name} (System Prompt: {system_prompt[:50]}...")

            # Add patient context to system prompt
            context_str = _build_patient_context(
                patient_context.get('name'),
                patient_context.get('dob'),
                patient_context.get('gender')
            )
            if context_str:
                system_prompt += f"\n\nPatient context: {context_str}"

            system_prompt += "\n\nPut your response in a code block but do not use any other markdown."

            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Please extract the {field_name} from this medical document:\n\n{extracted_text}",
                },
                {
                    "role": "assistant",
                    "content": f"I'll extract the requested information and provide it in a code block:\n```\n{field_name}:"
                },
            ]

            # Stop options with the code-block prompt
            options["temperature"] = 0.1
            options["stop"] = ["```"]

            response = await client.chat(
                model=config["PRIMARY_MODEL"],
                messages=messages,
                options=options,
            )

            # Strip leading and trailing newlines
            results[field_key] = response["message"]["content"].strip()

        except Exception as e:
            logger.error(f"Error processing field {field_name}: {str(e)}")
            results[field_key] = f"Error extracting {field_name}"

    logger.info(f"Successfully processed {len(results)} template fields")
    return results


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
