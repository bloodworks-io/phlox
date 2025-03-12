from fastapi import APIRouter, Depends
from fastapi.exceptions import HTTPException
from fastapi.responses import StreamingResponse
from server.utils.chat import ChatEngine
from server.schemas.chat import ChatRequest, ChatResponse
import logging
import json
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

        async def generate():
            chunk_count = 0
            async for chunk in chat_engine.stream_chat(conversation_history, raw_transcription=raw_transcription ):
                chunk_count += 1
                yield f"data: {json.dumps(chunk)}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream"
        )
    except Exception as e:
        logging.error(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=str(e))
