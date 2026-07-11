"""Embedding model endpoints (single-model, Tauri-only)."""

import asyncio
import json
import logging

from fastapi import APIRouter
from fastapi.exceptions import HTTPException
from fastapi.responses import StreamingResponse

from server.constants import IS_DOCKER
from server.utils.embedding_models import (
    EMBEDDING_FILENAME,
    EMBEDDING_SIZE_MB,
    delete_embedding_model,
    download_embedding_model,
    get_downloaded_size_mb,
    is_embedding_model_downloaded,
)

router = APIRouter()

logger = logging.getLogger(__name__)


def _ensure_not_docker():
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local embedding models are only available in Tauri builds",
        )


@router.get("/local/embedding/status")
async def get_embedding_status():
    """Whether the embedding model is downloaded, plus metadata."""
    _ensure_not_docker()

    downloaded = is_embedding_model_downloaded()
    return {
        "downloaded": downloaded,
        "filename": EMBEDDING_FILENAME,
        "size_mb": EMBEDDING_SIZE_MB,
        "downloaded_size_mb": get_downloaded_size_mb() if downloaded else None,
    }


@router.get("/local/embedding/download/stream")
async def download_embedding_model_stream():
    """Stream the embedding model download progress via SSE."""
    _ensure_not_docker()

    async def generate():
        queue: asyncio.Queue = asyncio.Queue()

        async def progress_callback(progress):
            await queue.put(
                {
                    "type": "progress",
                    "percentage": progress.percentage,
                    "downloaded_bytes": progress.downloaded_bytes,
                    "total_bytes": progress.total_bytes,
                    "speed_bytes_per_sec": progress.speed_bytes_per_sec,
                    "eta_seconds": progress.eta_seconds,
                }
            )

        download_task = asyncio.create_task(
            download_embedding_model(progress_callback=progress_callback)
        )

        yield f"data: {json.dumps({'type': 'start', 'filename': EMBEDDING_FILENAME})}\n\n"

        try:
            while not download_task.done():
                try:
                    progress = await asyncio.wait_for(queue.get(), timeout=0.5)
                    yield f"data: {json.dumps(progress)}\n\n"
                except TimeoutError:
                    yield ": keepalive\n\n"

            downloaded_path = await download_task
            size_mb = round(downloaded_path.stat().st_size / (1024 * 1024), 2)

            yield f"data: {json.dumps({'type': 'complete', 'filename': EMBEDDING_FILENAME, 'size_mb': size_mb})}\n\n"

        except Exception as e:
            logger.error("Embedding download error: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.delete("/local/embedding")
async def delete_embedding():
    """Delete the downloaded embedding model."""
    _ensure_not_docker()

    if delete_embedding_model():
        return {"message": "Embedding model deleted successfully"}
    raise HTTPException(status_code=404, detail="Embedding model not found")
