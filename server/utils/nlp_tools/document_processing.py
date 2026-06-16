import asyncio
import io
import logging
from typing import Any

# Optional PDF text-layer dependency (preferred path for PDFs)
try:
    from pypdf import PdfReader

    PDF_TEXT_AVAILABLE = True
except ImportError:
    PDF_TEXT_AVAILABLE = False
    PdfReader = None

# Optional OCR dependencies (for image documents)
try:
    import pytesseract
    from PIL import Image

    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    Image = None
    pytesseract = None

from server.database.config.manager import config_manager
from server.schemas.grammars import MultiFieldResponse
from server.schemas.patient import DemographicsExtraction
from server.utils.helpers import calculate_age
from server.utils.llm_client.client import get_llm_client
from server.utils.llm_client.utils import repair_json
from server.utils.transcription.refinement import refine_field_content
from server.utils.transcription.text import process_all_fields_concurrently

# Set up module-level logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


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
        logger.info("Backend PDF parsing invoked")
        text_from_layer = _extract_pdf_text_layer(document_buffer)

        if _is_extracted_text_usable(text_from_layer):
            logger.info("Using extracted PDF text layer content")
            return text_from_layer

        if text_from_layer.strip():
            logger.warning(
                "Returning partial PDF text layer output because it's the best available"
            )
            return text_from_layer

        raise RuntimeError(
            "No usable PDF text found. "
            "Frontend PDF text extraction (pdfjs-dist) is the primary path. "
            "Install pypdf for backend fallback text-layer extraction."
        )

    # Non-PDF binary documents are treated as images and require OCR
    if not OCR_AVAILABLE:
        raise RuntimeError("Image document processing requires Pillow and pytesseract.")

    logger.debug("Processing image document with Tesseract OCR")
    img = Image.open(io.BytesIO(document_buffer))  # ty: ignore
    text = pytesseract.image_to_string(img)  # ty: ignore
    return text


def _extract_pdf_text_layer(document_buffer: bytes) -> str:
    """
    Extract text from embedded PDF text layer using pypdf.
    """
    logger.info("Backend PDF parser component called: pypdf text-layer extraction")
    if not PDF_TEXT_AVAILABLE:
        logger.debug("pypdf not available; skipping PDF text-layer extraction")
        return ""

    try:
        reader = PdfReader(io.BytesIO(document_buffer))  # ty: ignore
        page_texts = []
        for page in reader.pages:
            page_texts.append(page.extract_text() or "")
        return "\n\n".join(page_texts).strip()
    except Exception as e:
        logger.warning(f"Failed PDF text-layer extraction: {e}")
        return ""


def _is_extracted_text_usable(text: str) -> bool:
    """
    Heuristic check for whether extracted text is likely usable.
    """
    normalized = (text or "").strip()
    if len(normalized) < 120:
        return False

    alnum_count = sum(1 for ch in normalized if ch.isalnum())
    return alnum_count >= 80


# Free-text fields the LLM sometimes returns in ALL CAPS; title-cased after
# extraction (kept out of the prompt — simple post-processing only).
_DEMOGRAPHICS_TITLE_CASE_FIELDS = ("first_name", "last_name", "address")


def _normalize_extracted_demographics(data: dict[str, Any]) -> dict[str, Any]:
    """Title-case name/address fields; leave identifiers and dates untouched."""
    for key in _DEMOGRAPHICS_TITLE_CASE_FIELDS:
        value = data.get(key)
        if isinstance(value, str) and value:
            data[key] = value.title()
    return data


async def extract_demographics_from_document(
    document_buffer: bytes, content_type: str
) -> dict[str, Any]:
    """Extract patient demographics from an uploaded document."""
    extracted_text = await extract_text_from_document(document_buffer, content_type)
    return await _extract_demographics_from_text(extracted_text)


async def _extract_demographics_from_text(text: str) -> dict[str, Any]:
    """One LLM call to pull patient demographics out of document text.

    Returns only fields the model could determine (others omitted, not null),
    so the caller can merge without blanking existing values.
    """
    config = config_manager.get_config()
    options = config_manager.get_prompts_and_options()["options"]["general"].copy()
    options["temperature"] = 0
    options.pop("stop", None)

    response_format = DemographicsExtraction.model_json_schema()

    system_content = (
        "Extract the patient's demographic details from the provided document text. "
        "Return ONLY valid JSON with these keys: "
        "first_name, last_name, dob (ISO YYYY-MM-DD when determinable), "
        "gender (single letter 'M' or 'F' when stated), ur_number, address, phone. "
        "Use null for any field not present in the document. Do not guess or infer."
    )

    request_body = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": text or "(no text)"},
    ]

    client = get_llm_client(timeout=120)
    max_retries = 2

    for attempt in range(max_retries + 1):
        try:
            response = await client.chat(
                model=config["PRIMARY_MODEL"],
                messages=request_body,
                format=response_format,
                options=options,
            )
            repaired = repair_json(response["message"]["content"])
            data = DemographicsExtraction.model_validate_json(repaired)
            # Keep only populated fields so merges don't clobber existing values.
            result = {k: v for k, v in data.model_dump().items() if v}
            return _normalize_extracted_demographics(result)
        except Exception as e:
            if attempt < max_retries:
                logger.warning(
                    f"Demographics extraction attempt {attempt + 1} failed: {e}. Retrying..."
                )
                continue
            logger.error(f"Demographics extraction failed after {max_retries + 1} attempts: {e}")
            raise

    raise RuntimeError("Unreachable: demographics extraction exhausted retries")


async def process_document_with_template(
    document_buffer: bytes,
    content_type: str,
    template_fields: list[Any],
    patient_context: dict[str, Any],
) -> dict[str, Any]:
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
) -> dict[str, Any]:
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
) -> dict[str, Any]:
    """
    Template processing logic that operates on extracted document text.
    """
    try:
        raw_results_dict = await process_all_fields_concurrently(
            transcript_text=extracted_text,
            fields=template_fields,
            patient_context=patient_context,
            intro_override="Extract relevant information for each field from the provided medical document.",
        )

        refined_results = await asyncio.gather(
            *[
                refine_field_content(raw_results_dict[field.field_key], field)
                for field in template_fields
            ]
        )

        results = {
            field.field_key: refined_content
            for field, refined_content in zip(template_fields, refined_results, strict=True)
        }

        logger.info(f"Successfully processed {len(results)} template fields")
        return results

    except Exception as e:
        logger.error(f"Error processing extracted text with template: {str(e)}")
        raise


async def _run_vision_extraction(
    system_content: str,
    response_model: type,
    visual_pages: list[dict[str, Any]],
):
    """Shared vision-LLM core: filter pages, call the model with retries, and
    validate the JSON response against ``response_model`` (a pydantic class).
    Returns the validated pydantic instance. Used by demographics visual
    extraction; the template visual path can adopt it as a follow-up.
    """
    if not visual_pages:
        raise ValueError("No visual pages were provided")

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

    response_format = response_model.model_json_schema()

    user_content: list[dict[str, Any]] = [
        {"type": "text", "text": "Please extract the fields from these document images."}
    ]
    for page in valid_pages:
        user_content.append(
            {
                "type": "image_url",
                "image_url": {"url": page["data_url"]},
            }
        )

    request_body = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]

    client = get_llm_client(timeout=180)
    max_retries = 2

    for attempt in range(max_retries + 1):
        try:
            logger.info(
                f"Vision extraction with {len(valid_pages)} pages "
                f"(attempt {attempt + 1}/{max_retries + 1})..."
            )
            response = await client.chat(
                model=config["PRIMARY_MODEL"],
                messages=request_body,
                format=response_format,
                options=options,
            )
            repaired_content = repair_json(response["message"]["content"])
            return response_model.model_validate_json(repaired_content)
        except Exception as e:
            if attempt < max_retries:
                logger.warning(
                    f"Vision extraction attempt {attempt + 1}/{max_retries + 1} failed: {e}. Retrying..."
                )
                continue
            logger.error(
                f"Vision extraction failed after {max_retries + 1} attempts: {e}"
            )
            raise

    raise RuntimeError("Unreachable: vision extraction exhausted retries")


async def extract_demographics_from_visual_pages(
    visual_pages: list[dict[str, Any]],
) -> dict[str, Any]:
    """Extract patient demographics from rendered document page images."""
    system_content = (
        "Extract the patient's demographic details from the provided document images. "
        "Return ONLY valid JSON with these keys: "
        "first_name, last_name, dob (ISO YYYY-MM-DD when determinable), "
        "gender (single letter 'M' or 'F' when stated), ur_number, address, phone. "
        "Use null for any field not present in the document. Do not guess or infer."
    )
    data = await _run_vision_extraction(system_content, DemographicsExtraction, visual_pages)
    result = {k: v for k, v in data.model_dump().items() if v}
    return _normalize_extracted_demographics(result)


async def process_visual_document_with_template(
    visual_pages: list[dict[str, Any]],
    template_fields: list[Any],
    patient_context: dict[str, Any],
) -> dict[str, Any]:
    """
    Process visual document pages with a multimodal model to fill template fields.

    Builds the template field instructions, delegates the vision call to the
    shared ``_run_vision_extraction`` core, then bullet-formats and refines each
    field through the existing refinement pipeline.
    """
    if not template_fields:
        raise ValueError("Template fields are required for visual document processing")

    # Build patient context
    context_str = ""
    if patient_context:
        context_str = _build_patient_context(
            patient_context.get("name"),
            patient_context.get("dob"),
            patient_context.get("gender"),
        )

    # Build combined field instructions (same pattern as text.py)
    field_instructions = []
    for field in template_fields:
        field_instructions.append(
            f"FIELD: {field.field_key}\n"
            f"NAME: {field.field_name}\n"
            f"INSTRUCTIONS: {(getattr(field, 'system_prompt', '') or '').strip()}"
        )

    system_content = (
        "Extract relevant information for each field from the provided medical document images.\n"
        f"{context_str}\n\n"
        "For each field, extract only the most relevant information. "
        "If no relevant information is found for a field, return an empty list for that field.\n\n"
        "FIELDS:\n" + "\n".join(field_instructions) + "\n\n"
        "Output MUST be ONLY valid JSON with top-level key "
        '"field_summaries" (object mapping field_key to array of strings).'
    )

    multi_field_response = await _run_vision_extraction(
        system_content, MultiFieldResponse, visual_pages
    )

    # Convert to dict of formatted strings (with bullet points)
    raw_results: dict[str, str] = {}
    for field in template_fields:
        key_points = multi_field_response.field_summaries.get(field.field_key, [])
        formatted_content = "\n".join(f"• {point.strip()}" for point in key_points)
        raw_results[field.field_key] = formatted_content

    logger.info(
        f"Successfully extracted {len(template_fields)} fields from visual document"
    )

    # Refine all fields concurrently (fast text-only calls)
    refined_results = await asyncio.gather(
        *[
            refine_field_content(raw_results[field.field_key], field)
            for field in template_fields
        ]
    )

    return {
        field.field_key: refined
        for field, refined in zip(template_fields, refined_results, strict=True)
    }


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
