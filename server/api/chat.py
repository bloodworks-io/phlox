import json
import logging

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.exceptions import HTTPException
from fastapi.responses import StreamingResponse

from server.schemas.chat import ChatRequest, ChatResponse
from server.utils.chat import ChatEngine
from server.utils.nlp_tools.document_processing import extract_text_from_document

router = APIRouter()


def _get_chat_engine():
    return ChatEngine()


@router.post("", response_model=ChatResponse)
async def chat(
    chat_request: ChatRequest,
    chat_engine: ChatEngine = Depends(_get_chat_engine),
):
    """
    Process a chat request and return a streaming response.

    This endpoint accepts a chat request containing a conversation history and uses
    ChatEngine to generate responses asynchronously. The response chunks are streamed as
    Server Side Events.

    Args:
        chat_request (ChatRequest): The incoming chat request containing chat messages.
        chat_engine (ChatEngine): The chat engine used to process the chat request.

    Returns:
        StreamingResponse: An SSE streaming response that yields response chunks
                           formatted as JSON with the prefix "data: " and separated by newlines.

    Raises:
        HTTPException: If an error occurs during processing, a 500 error is raised with details.
    """
    try:
        logging.info("Received chat request")
        logging.debug(f"Chat request: {chat_request}")

        conversation_history = chat_request.messages
        raw_transcription = chat_request.raw_transcription
        patient_context = (
            chat_request.patient_context.model_dump() if chat_request.patient_context else None
        )

        async def generate():
            chunk_count = 0
            async for chunk in chat_engine.stream_chat(
                conversation_history,
                raw_transcription=raw_transcription,
                patient_context=patient_context,
            ):
                chunk_count += 1
                yield f"data: {json.dumps(chunk)}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """
    Generic image/document upload endpoint for chat.

    Accepts images (png, jpg, etc.) and PDFs.
    Currently uses OCR to extract text; designed to be extensible for multimodal LLM.

    Returns extracted text for the LLM to interpret.
    """
    try:
        logging.info(f"Received image upload: {file.filename}, content_type: {file.content_type}")

        content = await file.read()
        content_type = file.content_type

        # OCR extract text using existing pipeline
        # (handles both images and PDFs - converts PDFs to images internally)
        extracted_text = await extract_text_from_document(content, content_type)

        logging.info(f"Successfully extracted {len(extracted_text)} characters from image")

        return {
            "text": extracted_text,
            "content_type": content_type,
            "filename": file.filename
        }
    except RuntimeError as e:
        # OCR dependencies not available
        logging.error(f"OCR not available: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logging.error(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))
