import asyncio
import io
import json
import logging
from typing import Any

# Optional PDF text-layer dependency (preferred path for PDFs)
try:
    from pypdf import PdfReader

    PDF_TEXT_AVAILABLE = True
except ImportError:
    PDF_TEXT_AVAILABLE = False
    PdfReader = None

# Optional OCR dependencies (fallback path)
try:
    from PIL import Image
    import fitz  # PyMuPDF for PDF rasterization
    import pytesseract

    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    Image = None
    fitz = None
    pytesseract = None

from server.database.config.manager import config_manager
from server.schemas.grammars import FieldResponse
from server.schemas.templates import TemplateResponse
from server.utils.helpers import calculate_age
from server.utils.llm_client.client import get_llm_client
from server.utils.transcription.refinement import refine_field_content

# Set up module-level logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


async def process_document_content(
    document_buffer: bytes,
    content_type: str,
    name: str | None = None,
    dob: str | None = None,
    gender: str | None = None,
) -> tuple[str, str, str]:
    """
    Process document content and return legacy section outputs.

    This function now extracts document text first, then reuses the shared
    extracted-text processing path.
    """
    extracted_text = await extract_text_from_document(document_buffer, content_type)
    return await _process_extracted_text_sections(extracted_text, name=name, dob=dob, gender=gender)


async def _process_extracted_text_sections(
    extracted_text: str,
    name: str | None = None,
    dob: str | None = None,
    gender: str | None = None,
) -> tuple[str, str, str]:
    """
    Process already-extracted document text and return legacy section outputs.
    """
    config = config_manager.get_config()
    prompts = config_manager.get_prompts_and_options()
    options = prompts["options"]["general"].copy()
    del options["stop"]

    async def process_section(section_type: str, system_prompt: str) -> str:
        """
        Process a specific section of the medical document using LLM.
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

    try:
        logger.info("Starting concurrent processing of document sections")
        results = await asyncio.gather(
            *[process_section(section, prompt) for section, prompt in prompts.items()]
        )

        primary_history = "# " + results[0].split("#", 1)[-1].strip()

        additional_history = "# " + results[1].split("#", 1)[-1].strip() + "\n\n"
        additional_history += "Medications:\n" + results[2].strip() + "\n\n"
        additional_history += "Social History:\n" + results[3].strip()

        investigations = "- " + results[4].split("-", 1)[-1].strip()

        logger.info("Successfully processed all document sections")
        return primary_history, additional_history, investigations

    except Exception as e:
        logger.error(f"Error processing document sections: {str(e)}")
        raise


async def extract_text_from_document(document_buffer: bytes, content_type: str) -> str:
    """
    Extract text from document.

    Strategy:
    1) For PDFs, prefer direct extraction from PDF text layer.
    2) If PDF text appears insufficient, fallback to OCR if available.
    3) For images, use OCR when available.

    Args:
        document_buffer: Binary content of the document
        content_type: MIME type of the document

    Returns:
        Extracted text from the document

    Raises:
        RuntimeError: If required extraction dependencies are not available
    """
    logger.info(f"Extracting text from document with content type: {content_type}")

    # If content type is text, return the text directly
    if content_type in ["text/plain", "text/html"]:
        if isinstance(document_buffer, bytes):
            return document_buffer.decode("utf-8")
        return document_buffer

    if content_type == "application/pdf":
        logger.debug("Processing PDF document (text-layer first strategy)")
        text_from_layer = _extract_pdf_text_layer(document_buffer)

        if _is_extracted_text_usable(text_from_layer):
            logger.info("Using extracted PDF text layer content")
            return text_from_layer

        logger.info("PDF text layer unavailable/insufficient; attempting OCR fallback")
        if OCR_AVAILABLE:
            return _extract_pdf_text_with_ocr(document_buffer)

        if text_from_layer.strip():
            logger.warning(
                "Returning partial PDF text layer output because OCR dependencies are unavailable"
            )
            return text_from_layer

        raise RuntimeError(
            "No usable PDF text found and OCR dependencies are unavailable. "
            "Install pypdf for text-layer extraction and/or PyMuPDF + Pillow + pytesseract for OCR fallback."
        )

    # Non-PDF binary documents are treated as images and require OCR
    if not OCR_AVAILABLE:
        raise RuntimeError("Image document processing requires PyMuPDF, Pillow and pytesseract.")

    logger.debug("Processing image document with Tesseract OCR")
    img = Image.open(io.BytesIO(document_buffer))
    text = pytesseract.image_to_string(img)
    return text


def _extract_pdf_text_layer(document_buffer: bytes) -> str:
    """
    Extract text from embedded PDF text layer using pypdf.
    """
    if not PDF_TEXT_AVAILABLE:
        logger.debug("pypdf not available; skipping PDF text-layer extraction")
        return ""

    try:
        reader = PdfReader(io.BytesIO(document_buffer))
        page_texts = []
        for page in reader.pages:
            page_texts.append(page.extract_text() or "")
        return "\n\n".join(page_texts).strip()
    except Exception as e:
        logger.warning(f"Failed PDF text-layer extraction: {e}")
        return ""


def _extract_pdf_text_with_ocr(document_buffer: bytes) -> str:
    """
    OCR fallback for PDFs: rasterize pages with PyMuPDF then OCR with pytesseract.
    """
    extracted_texts = []
    pdf_document = fitz.open(stream=document_buffer, filetype="pdf")

    for page_num in range(pdf_document.page_count):
        page = pdf_document[page_num]
        pix = page.get_pixmap()
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        text = pytesseract.image_to_string(img)
        extracted_texts.append(text)
        logger.debug(f"Extracted text from PDF page {page_num + 1}/{pdf_document.page_count}")

    return "\n\n".join(extracted_texts).strip()


def _is_extracted_text_usable(text: str) -> bool:
    """
    Heuristic check for whether extracted text is likely usable.
    """
    normalized = (text or "").strip()
    if len(normalized) < 120:
        return False

    alnum_count = sum(1 for ch in normalized if ch.isalnum())
    return alnum_count >= 80


async def process_document_with_template(
    document_buffer: bytes,
    content_type: str,
    template_fields: list[Any],
    patient_context: dict[str, Any],
) -> dict[str, str]:
    """
    Process document content and extract information to fill template fields.
    """
    logger.info(
        f"Processing document with template containing {len(template_fields) if template_fields else 0} fields"
    )

    logging.info("Extracting text from document")
    extracted_text = await extract_text_from_document(document_buffer, content_type)

    return await process_document_text_with_template(
        extracted_text=extracted_text,
        template_fields=template_fields,
        patient_context=patient_context,
    )


async def process_document_text_with_template(
    extracted_text: str,
    template_fields: list[Any],
    patient_context: dict[str, Any],
) -> dict[str, str]:
    """
    Process already-extracted document text and extract information to fill template fields.
    """
    logger.info(
        f"Processing extracted document text with template containing {len(template_fields) if template_fields else 0} fields"
    )
    return await _process_extracted_text_with_template(
        extracted_text=extracted_text,
        template_fields=template_fields,
        patient_context=patient_context,
    )


async def _process_extracted_text_with_template(
    extracted_text: str,
    template_fields: list[Any],
    patient_context: dict[str, Any],
) -> dict[str, str]:
    """
    Shared template processing logic that operates on extracted text.
    """
    # If there are no template fields, use the legacy section-style extraction
    if not template_fields:
        logger.info("No template fields provided, using legacy processing method")
        primary_history, additional_history, investigations = await _process_extracted_text_sections(
            extracted_text,
            patient_context.get("name"),
            patient_context.get("dob"),
            patient_context.get("gender"),
        )

        return {
            "primary_history": primary_history,
            "additional_history": additional_history,
            "investigations": investigations,
        }

    try:
        raw_results = await asyncio.gather(
            *[
                process_document_field(extracted_text, field, patient_context)
                for field in template_fields
            ]
        )

        refined_results = await asyncio.gather(
            *[
                refine_field_content(result.content, field)
                for result, field in zip(raw_results, template_fields)
            ]
        )

        results = {
            field.field_key: refined_content
            for field, refined_content in zip(template_fields, refined_results)
        }

        logger.info(f"Successfully processed {len(results)} template fields")
        return results

    except Exception as e:
        logger.error(f"Error processing extracted text with template: {str(e)}")
        raise


async def process_visual_document_with_template(
    visual_pages: list[dict[str, Any]],
    template_fields: list[Any],
    patient_context: dict[str, Any],
) -> dict[str, str]:
    """
    Process visual document pages directly with a multimodal model to fill template fields.

    Each field is extracted from images directly (no OCR text pre-extraction step).
    """
    if not visual_pages:
        raise ValueError("No visual pages were provided")

    if not template_fields:
        raise ValueError("Template fields are required for visual document processing")

    # Keep only valid image data URLs and cap page count defensively
    valid_pages = [
        page
        for page in visual_pages
        if isinstance(page, dict)
        and isinstance(page.get("data_url"), str)
        and page.get("data_url", "").startswith("data:image/")
    ][:8]

    if not valid_pages:
        raise ValueError("No valid image data URLs were provided")

    config = config_manager.get_config()
    options = config_manager.get_prompts_and_options()["options"]["general"].copy()
    options["temperature"] = 0
    options.pop("stop", None)

    client = get_llm_client()
    response_format = FieldResponse.model_json_schema()

    # Build patient context once
    context_str = ""
    if patient_context:
        context_str = _build_patient_context(
            patient_context.get("name"),
            patient_context.get("dob"),
            patient_context.get("gender"),
        )

    async def process_visual_field(field: Any) -> tuple[str, str]:
        field_name = field.field_name
        system_prompt = getattr(field, "system_prompt", "") or ""

        if not system_prompt:
            system_prompt = (
                f"You are a medical documentation assistant. "
                f"Extract the {field_name} from the provided medical document images."
            )

        if hasattr(field, "style_example") and field.style_example:
            system_prompt += f"\n\nOutput style example:\n{field.style_example}"

        json_schema_instruction = (
            "Output MUST be ONLY valid JSON with top-level key "
            '"key_points" (array of strings). Example: ' + json.dumps({"key_points": ["..."]})
        )

        instruction = (
            f"Please extract the {field_name} from these document images."
            + (f"\n\nPatient context: {context_str}" if context_str else "")
        )

        user_content: list[dict[str, Any]] = [{"type": "text", "text": instruction}]
        for page in valid_pages:
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": page["data_url"]},
                }
            )

        request_body = [
            {
                "role": "system",
                "content": f"{system_prompt}\n\n{json_schema_instruction}",
            },
            {
                "role": "user",
                "content": user_content,
            },
        ]

        logger.info(f"Processing visual document field: {field_name}")

        response = await client.chat(
            model=config["PRIMARY_MODEL"],
            messages=request_body,
            format=response_format,
            options=options,
        )

        field_response = FieldResponse.model_validate_json(response["message"]["content"])
        formatted_content = "\n".join(f"• {point.strip()}" for point in field_response.key_points)

        refined_content = await refine_field_content(formatted_content, field)
        return field.field_key, refined_content

    results = await asyncio.gather(*[process_visual_field(field) for field in template_fields])
    return {field_key: content for field_key, content in results}


async def process_document_field(
    document_text: str, field: Any, patient_context: dict[str, Any]
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
        system_prompt = getattr(field, "system_prompt", "") or ""

        # If no system prompt is provided, create a default one
        if not system_prompt:
            system_prompt = f"You are a medical documentation assistant. Extract the {field_name} from the provided medical document."

        if hasattr(field, "style_example") and field.style_example:
            system_prompt += f"\n\nOutput style example:\n{field.style_example}"

        json_schema_instruction = (
            "Output MUST be ONLY valid JSON with top-level key "
            '"key_points" (array of strings). Example: ' + json.dumps({"key_points": ["..."]})
        )

        # Build patient context for the prompt
        context_str = ""
        if patient_context:
            # Convert dictionary to format expected by _build_patient_context
            context_str = _build_patient_context(
                patient_context.get("name"),
                patient_context.get("dob"),
                patient_context.get("gender"),
            )

        # Build a single system message so strict chat templates don't reject
        # requests with additional system messages later in the list.
        system_content = f"{system_prompt}\n\n{json_schema_instruction}"
        if context_str:
            system_content += f"\n\nPatient context: {context_str}"

        # Create the request messages
        request_body = [
            {
                "role": "system",
                "content": system_content,
            },
            {
                "role": "user",
                "content": f"Please extract the {field_name} from this medical document:\n\n{document_text}",
            },
        ]

        logger.info(f"Processing document field: {field_name}")

        # Set temperature to 0 for deterministic output
        options["temperature"] = 0

        # Make the API call
        response = await client.chat(
            model=config["PRIMARY_MODEL"],
            messages=request_body,
            format=response_format,
            options=options,
        )

        # Parse the response
        field_response = FieldResponse.model_validate_json(response["message"]["content"])

        # Convert key points into a formatted string
        formatted_content = "\n".join(f"• {point.strip()}" for point in field_response.key_points)

        return TemplateResponse(field_key=field.field_key, content=formatted_content)

    except Exception as e:
        logger.error(f"Error processing document field {field.field_key}: {e}")
        # Return empty result on error
        return TemplateResponse(
            field_key=field.field_key,
            content=f"Error extracting {field.field_name}: {str(e)}",
        )


def _build_patient_context(name: str | None, dob: str | None, gender: str | None) -> str:
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


def _parse_model_output(output: str) -> tuple[str, str, str]:
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
            additional_history = section.replace("Additional History:", "").strip()
        elif section.startswith("Investigations:"):
            current_section = "investigations"
            investigations = section.replace("Investigations:", "").strip()

    return primary_history, additional_history, investigations
