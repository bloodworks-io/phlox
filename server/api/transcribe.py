import logging
import time

from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from pydantic import BaseModel, Field

from server.schemas.patient import TranscribeResponse
from server.utils.nlp_tools.document_processing import (
    _extract_demographics_from_text,
    extract_demographics_from_document,
    extract_demographics_from_visual_pages,
    process_document_text_with_template,
    process_document_with_template,
    process_visual_document_with_template,
)
from server.utils.transcription.audio import transcribe_audio
from server.utils.transcription.text import process_transcription

router = APIRouter()


class ProcessDocumentFromTextRequest(BaseModel):
    extracted_text: str
    name: str | None = None
    gender: str | None = None
    dob: str | None = None
    templateKey: str = Field(..., description="Template key is required for document processing")


class VisualDocumentPage(BaseModel):
    page_number: int
    data_url: str
    mime_type: str | None = None
    width: int | None = None
    height: int | None = None


class ProcessVisualDocumentRequest(BaseModel):
    pages: list[VisualDocumentPage]
    filename: str | None = None
    content_type: str | None = None
    name: str | None = None
    gender: str | None = None
    dob: str | None = None
    templateKey: str = Field(..., description="Template key is required for document processing")


class ExtractDemographicsFromTextRequest(BaseModel):
    extracted_text: str


class ExtractDemographicsVisualRequest(BaseModel):
    pages: list[VisualDocumentPage]


@router.post("/audio", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    name: str | None = Form(None),
    gender: str | None = Form(None),
    dob: str | None = Form(None),
    templateKey: str | None = Form(None),
    isAmbient: bool = Form(True),
    noteId: int | None = Form(None),
):
    """Transcribes audio and processes the transcription."""
    try:
        # Read the audio file
        audio_buffer = await file.read()

        # Process the name if provided
        formatted_name = "N/A"
        if name:
            name_parts = name.split(",")
            last_name = name_parts[0].strip()
            first_name = name_parts[1].strip()
            formatted_name = f"{first_name} {last_name}"

        # Perform transcription
        transcription_result = await transcribe_audio(audio_buffer)
        transcript_text = str(transcription_result["text"])
        transcription_duration = float(transcription_result["transcriptionDuration"])

        # Get template fields if template key is provided
        template_fields = []
        if templateKey:
            from server.database.entities.templates import get_template_fields

            template_fields = get_template_fields(templateKey)

        # Look up primary condition for returning patients
        primary_condition = None
        if noteId:
            from server.database.entities.patient import get_patient_by_id

            existing_patient = get_patient_by_id(noteId)
            if existing_patient and existing_patient.get("primary_condition"):
                primary_condition = existing_patient["primary_condition"]

        # Create patient context
        patient_context = {"name": formatted_name, "dob": dob, "gender": gender}

        # Process the transcription with template fields
        processing_result = await process_transcription(
            transcript_text=transcript_text,
            template_fields=template_fields,
            patient_context=patient_context,
            is_ambient=isAmbient,
            primary_condition=primary_condition,
        )

        # Return the response in the expected format
        return TranscribeResponse(
            fields=dict(processing_result["fields"]),
            rawTranscription=transcript_text,
            transcriptionDuration=transcription_duration,
            processDuration=float(processing_result["process_duration"]),
        )

    except Exception as e:
        logging.error(f"Error occurred: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/dictate")
async def dictate(file: UploadFile = File(...)):
    """Transcribes the dictated audio."""
    try:
        # Read the audio file
        audio_buffer = await file.read()

        # Perform transcription
        transcription_result = await transcribe_audio(audio_buffer)
        transcript_text = str(transcription_result["text"])
        transcription_duration = float(transcription_result["transcriptionDuration"])

        # Return the response
        return {
            "transcription": transcript_text,
            "transcriptionDuration": transcription_duration,
        }
    except Exception as e:
        logging.error(f"Error occurred during dictation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/reprocess", response_model=TranscribeResponse)
async def reprocess_transcription(
    transcript_text: str = Form(...),
    name: str | None = Form(None),
    gender: str | None = Form(None),
    dob: str | None = Form(None),
    original_transcription_duration: float | None = Form(0),
    templateKey: str | None = Form(None),
    isAmbient: bool = Form(True),
    noteId: int | None = Form(None),
):
    """Reprocesses an existing transcription."""
    try:
        # Process the name if provided
        formatted_name = "N/A"
        if name:
            name_parts = name.split(",")
            last_name = name_parts[0].strip()
            first_name = name_parts[1].strip()
            formatted_name = f"{first_name} {last_name}"

        # Get template fields if template key is provided
        template_fields = []
        if templateKey:
            from server.database.entities.templates import get_template_fields

            template_fields = get_template_fields(templateKey)

        # Look up primary condition for returning patients
        primary_condition = None
        if noteId:
            from server.database.entities.patient import get_patient_by_id

            existing_patient = get_patient_by_id(noteId)
            if existing_patient and existing_patient.get("primary_condition"):
                primary_condition = existing_patient["primary_condition"]

        # Create patient context
        patient_context = {"name": formatted_name, "dob": dob, "gender": gender}

        # Process the transcription with template fields
        processing_result = await process_transcription(
            transcript_text=transcript_text,
            template_fields=template_fields,
            patient_context=patient_context,
            is_ambient=isAmbient,
            primary_condition=primary_condition,
        )

        # Return the response in the expected format
        return TranscribeResponse(
            fields=dict(processing_result["fields"]),
            rawTranscription=transcript_text,
            transcriptionDuration=original_transcription_duration or 0.0,
            processDuration=float(processing_result["process_duration"]),
        )

    except Exception as e:
        logging.error(f"Error occurred during reprocessing: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/process-document", response_model=TranscribeResponse)  # Changed response model
async def process_document(
    file: UploadFile = File(...),
    name: str | None = Form(None),
    gender: str | None = Form(None),
    dob: str | None = Form(None),
    templateKey: str = Form(..., description="Template key is required for document processing"),
):
    """Processes a document to extract information and fill template fields."""
    try:
        # Read the document file
        document_buffer = await file.read()

        # Get the file type
        content_type = file.content_type

        # Process the name if provided
        formatted_name = "N/A"
        if name:
            name_parts = name.split(",")
            last_name = name_parts[0].strip()
            first_name = name_parts[1].strip()
            formatted_name = f"{first_name} {last_name}"

        from server.database.entities.templates import get_template_fields

        template_fields = get_template_fields(templateKey)

        # Create patient context
        patient_context = {"name": formatted_name, "dob": dob, "gender": gender}

        # Process the document
        process_start = time.perf_counter()
        result = await process_document_with_template(
            document_buffer, content_type or "", template_fields, patient_context
        )
        process_end = time.perf_counter()
        process_duration = process_end - process_start

        # The result is already in the format of field key-value pairs
        return TranscribeResponse(
            fields=result,
            rawTranscription="",  # We don't include raw transcription for document uploads
            transcriptionDuration=0,  # No transcription for documents
            processDuration=process_duration,
        )
    except Exception as e:
        logging.error(f"Error processing document: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/extract-demographics")
async def extract_demographics(file: UploadFile = File(...)):
    """Extract patient demographics from an uploaded document (referral, ID, etc.)."""
    try:
        document_buffer = await file.read()
        result = await extract_demographics_from_document(document_buffer, file.content_type or "")
        return result
    except Exception as e:
        logging.error(f"Error extracting demographics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/extract-demographics-from-text")
async def extract_demographics_from_text(payload: ExtractDemographicsFromTextRequest):
    """Extract patient demographics from already-extracted document text."""
    try:
        extracted_text = (payload.extracted_text or "").strip()
        if not extracted_text:
            raise HTTPException(status_code=400, detail="No extracted_text provided")
        return await _extract_demographics_from_text(extracted_text)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error extracting demographics from text: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/extract-demographics-visual")
async def extract_demographics_visual(payload: ExtractDemographicsVisualRequest):
    """Extract patient demographics from rendered document page images."""
    try:
        if not payload.pages:
            raise HTTPException(status_code=400, detail="No visual pages provided")
        visual_pages = [page.model_dump() for page in payload.pages]
        return await extract_demographics_from_visual_pages(visual_pages)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error extracting demographics from visual: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/process-document-visual", response_model=TranscribeResponse)
async def process_document_visual(payload: ProcessVisualDocumentRequest):
    """Processes visual document pages directly with multimodal field extraction."""
    try:
        if not payload.pages:
            raise HTTPException(status_code=400, detail="No visual pages provided")

        # Process the name if provided
        formatted_name = "N/A"
        if payload.name:
            name_parts = payload.name.split(",")
            last_name = name_parts[0].strip()
            first_name = name_parts[1].strip() if len(name_parts) > 1 else ""
            formatted_name = f"{first_name} {last_name}".strip()

        from server.database.entities.templates import get_template_fields

        template_fields = get_template_fields(payload.templateKey)

        # Create patient context
        patient_context = {
            "name": formatted_name,
            "dob": payload.dob,
            "gender": payload.gender,
        }

        # Convert pydantic models to dicts expected by visual processor
        visual_pages = [page.model_dump() for page in payload.pages]

        process_start = time.perf_counter()
        result = await process_visual_document_with_template(
            visual_pages=visual_pages,
            template_fields=template_fields,
            patient_context=patient_context,
        )
        process_end = time.perf_counter()
        process_duration = process_end - process_start

        return TranscribeResponse(
            fields=result,
            rawTranscription="",
            transcriptionDuration=0,
            processDuration=process_duration,
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing visual document: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/process-document-from-text", response_model=TranscribeResponse)
async def process_document_from_text(payload: ProcessDocumentFromTextRequest):
    """Processes already-extracted document text and fills template fields."""
    try:
        extracted_text = (payload.extracted_text or "").strip()
        if not extracted_text:
            raise HTTPException(status_code=400, detail="No extracted_text provided")

        # Process the name if provided
        formatted_name = "N/A"
        if payload.name:
            name_parts = payload.name.split(",")
            last_name = name_parts[0].strip()
            first_name = name_parts[1].strip() if len(name_parts) > 1 else ""
            formatted_name = f"{first_name} {last_name}".strip()

        from server.database.entities.templates import get_template_fields

        template_fields = get_template_fields(payload.templateKey)

        # Create patient context
        patient_context = {
            "name": formatted_name,
            "dob": payload.dob,
            "gender": payload.gender,
        }

        # Process extracted text directly (no file/OCR step)
        process_start = time.perf_counter()
        result = await process_document_text_with_template(
            extracted_text=extracted_text,
            template_fields=template_fields,
            patient_context=patient_context,
        )
        process_end = time.perf_counter()
        process_duration = process_end - process_start

        return TranscribeResponse(
            fields=result,
            rawTranscription="",
            transcriptionDuration=0,
            processDuration=process_duration,
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing extracted document text: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e
