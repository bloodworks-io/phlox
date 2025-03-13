from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    HTTPException,
)
from server.schemas.patient import TranscribeResponse, DocumentProcessResponse
import logging
import time
from typing import Optional
from server.utils.transcription import transcribe_audio, process_transcription
from server.utils.document_processing import process_document_with_template
router = APIRouter()


@router.post("/audio", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    templateKey: Optional[str] = Form(None),
):
    """Transcribes audio and processes the transcription."""
    try:
        # Read the audio file
        audio_buffer = await file.read()
        audio_size = len(audio_buffer)
        audio_duration = round(audio_size / (2 * 44100), 2)

        # Process the name if provided
        formatted_name = "N/A"
        if name:
            name_parts = name.split(",")
            last_name = name_parts[0].strip()
            first_name = name_parts[1].strip()
            formatted_name = f"{first_name} {last_name}"

        # Perform transcription
        transcription_result = await transcribe_audio(audio_buffer)
        transcript_text = transcription_result["text"]
        transcription_duration = transcription_result["transcriptionDuration"]

        # Get template fields if template key is provided
        template_fields = []
        if templateKey:
            from server.database.templates import get_template_fields
            template_fields = get_template_fields(templateKey)

        # Create patient context
        patient_context = {
            "name": formatted_name,
            "dob": dob,
            "gender": gender
        }

        # Process the transcription with template fields
        processing_result = await process_transcription(
            transcript_text=transcript_text,
            template_fields=template_fields,
            patient_context=patient_context
        )

        # Return the response in the expected format
        return TranscribeResponse(
            fields=processing_result["fields"],
            rawTranscription=transcript_text,
            transcriptionDuration=transcription_duration,
            processDuration=processing_result["process_duration"]
        )

    except Exception as e:
        logging.error(f"Error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dictate")
async def dictate(file: UploadFile = File(...)):
    """Transcribes the dictated audio."""
    try:
        # Read the audio file
        audio_buffer = await file.read()

        # Perform transcription
        transcription_result = await transcribe_audio(audio_buffer)
        transcript_text = transcription_result["text"]
        transcription_duration = transcription_result["transcriptionDuration"]

        # Return the response
        return {
            "transcription": transcript_text,
            "transcriptionDuration": transcription_duration,
        }
    except Exception as e:
        logging.error(f"Error occurred during dictation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reprocess", response_model=TranscribeResponse)
async def reprocess_transcription(
    transcript_text: str = Form(...),
    name: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    original_transcription_duration: Optional[float] = Form(0),
    templateKey: Optional[str] = Form(None),
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
            from server.database.templates import get_template_fields
            template_fields = get_template_fields(templateKey)

        # Create patient context
        patient_context = {
            "name": formatted_name,
            "dob": dob,
            "gender": gender
        }

        # Process the transcription with template fields
        processing_start = time.perf_counter()
        processing_result = await process_transcription(
            transcript_text=transcript_text,
            template_fields=template_fields,
            patient_context=patient_context
        )
        processing_end = time.perf_counter()

        # Return the response in the expected format
        return TranscribeResponse(
            fields=processing_result["fields"],
            rawTranscription=transcript_text,
            transcriptionDuration=original_transcription_duration,
            processDuration=processing_result["process_duration"]
        )

    except Exception as e:
        logging.error(f"Error occurred during reprocessing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process-document", response_model=TranscribeResponse)  # Changed response model
async def process_document(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    templateKey: Optional[str] = Form(None),
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

        # Get template fields if template key is provided
        template_fields = []
        if templateKey:
            from server.database.templates import get_template_fields
            template_fields = get_template_fields(templateKey)

        # Create patient context
        patient_context = {
            "name": formatted_name,
            "dob": dob,
            "gender": gender
        }

        # Process the document
        process_start = time.perf_counter()
        result = await process_document_with_template(
            document_buffer,
            content_type,
            template_fields,
            patient_context
        )
        process_end = time.perf_counter()
        process_duration = process_end - process_start

        # The result is already in the format of field key-value pairs
        return TranscribeResponse(
            fields=result,
            rawTranscription="", # We don't include raw transcription for document uploads
            transcriptionDuration=0, # No transcription for documents
            processDuration=process_duration,
        )
    except Exception as e:
        logging.error(f"Error processing document: {e}")
        raise HTTPException(status_code=500, detail=str(e))
