"""
Whisper model management API endpoints.

Provides endpoints for downloading, listing, and deleting Whisper models.
"""

import asyncio
import json
import logging

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import StreamingResponse

from server.constants import IS_DOCKER
from server.utils.whisper_models import whisper_model_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/local/whisper/models/available")
async def get_available_whisper_models():
    """Get list of available Whisper models for download."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Whisper models are only available in Tauri builds",
        )

    models = whisper_model_manager.get_available_models()
    return {"models": models}


@router.get("/local/whisper/models/downloaded")
async def get_downloaded_whisper_models():
    """Get list of downloaded Whisper models."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Whisper models are only available in Tauri builds",
        )

    models = whisper_model_manager.get_downloaded_models()
    return {"models": models}


@router.post("/local/whisper/models/download")
async def download_whisper_model(
    model_id: str = Body(
        ..., embed=True, description="Whisper model ID to download"
    )
):
    """Download a Whisper model."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Whisper models are only available in Tauri builds",
        )

    try:
        path = await whisper_model_manager.download_model(model_id)
        return {"message": "Model downloaded successfully", "path": path}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error downloading model {model_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to download model: {str(e)}"
        )


@router.get("/local/whisper/models/download/stream")
async def download_whisper_model_stream(model_id: str):
    """Stream download progress for Whisper model using SSE."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Whisper models are only available in Tauri builds",
        )

    if not model_id:
        raise HTTPException(status_code=422, detail="model_id is required")

    async def generate():
        queue = asyncio.Queue()

        async def progress_callback(progress):
            """Callback to queue progress events."""
            await queue.put(
                {
                    "type": "progress",
                    "percentage": progress.percentage,
                    "downloaded_bytes": progress.downloaded_bytes,
                    "total_bytes": progress.total_bytes,
                    "speed_bytes_per_sec": progress.speed_bytes_per_sec,
                    "eta_seconds": progress.eta_seconds,
                    "current_file": progress.current_file,
                }
            )

        # Start download in background task
        download_task = asyncio.create_task(
            whisper_model_manager.download_model(
                model_id, progress_callback=progress_callback
            )
        )

        # Send start event
        yield f"data: {json.dumps({'type': 'start', 'model_id': model_id})}\n\n"

        try:
            while not download_task.done():
                try:
                    progress = await asyncio.wait_for(queue.get(), timeout=0.5)
                    yield f"data: {json.dumps(progress)}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive to prevent connection timeout
                    yield ": keepalive\n\n"

            # Get final result
            downloaded_path = await download_task
            yield f"data: {json.dumps({'type': 'complete', 'path': downloaded_path})}\n\n"

        except ValueError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        except Exception as e:
            logger.error(f"Download error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': 'An error occurred during download'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.delete("/local/whisper/models/{model_id}")
async def delete_whisper_model(model_id: str):
    """Delete a downloaded Whisper model."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Whisper models are only available in Tauri builds",
        )

    success = whisper_model_manager.delete_model(model_id)
    if not success:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"message": "Model deleted successfully"}


@router.get("/local/whisper/status")
async def get_whisper_status():
    """Get status of local Whisper installation."""
    if IS_DOCKER:
        return {
            "available": False,
            "reason": "Whisper models are only available in Tauri builds",
        }

    models = whisper_model_manager.get_downloaded_models()
    default_exists = whisper_model_manager.ensure_default_model_exists()

    return {
        "available": len(models) > 0,
        "models": models,
        "models_count": len(models),
        "default_model_exists": default_exists,
        "models_dir": str(whisper_model_manager.models_dir),
    }


@router.get("/local/whisper/model-recommendations")
async def get_whisper_model_recommendations():
    """Get Whisper model recommendations.

    Returns a curated list of models with plain English descriptions.
    """
    model_recommendations = [
        {
            "id": "tiny.en",
            "name": "tiny.en",
            "simple_name": "Tiny",
            "size": "39MB",
            "description": "Great for real-time transcription during appointments",
            "badge": "⚡ Fast",
            "badge_color": "blue",
        },
        {
            "id": "base.en",
            "name": "base.en",
            "simple_name": "Standard",
            "size": "74MB",
            "description": "A good balance of speed and accuracy for everyday use",
            "badge": "⭐ Recommended",
            "badge_color": "purple",
        },
        {
            "id": "small.en",
            "name": "small.en",
            "simple_name": "Accurate",
            "size": "244MB",
            "description": "Better accuracy, still quick enough for most uses",
            "badge": "🎯 Best Quality",
            "badge_color": "green",
        },
        {
            "id": "medium.en",
            "name": "medium.en",
            "simple_name": "Professional",
            "size": "769MB",
            "description": "High accuracy when quality matters most",
            "badge": "💎 Premium",
            "badge_color": "orange",
        },
        {
            "id": "large-v3",
            "name": "large-v3",
            "simple_name": "Multilingual",
            "size": "1.5GB",
            "description": "Best accuracy, supports many languages",
            "badge": "🌍 Multi",
            "badge_color": "teal",
        },
    ]

    return {"models": model_recommendations}
