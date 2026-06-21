import asyncio
import json
import logging
from pathlib import Path

from fastapi import APIRouter, Body
from fastapi.exceptions import HTTPException
from fastapi.responses import StreamingResponse

from server.constants import IS_DOCKER
from server.utils.llama_models import llama_model_manager
from server.utils.whisper_models import whisper_model_manager

router = APIRouter()


@router.get("/local/whisper/models/downloaded")
async def get_downloaded_whisper_models():
    """Get list of downloaded Whisper models."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
        )

    try:
        models = whisper_model_manager.get_downloaded_models()
        return {"models": models}
    except Exception as e:
        logging.error(f"Error getting downloaded Whisper models: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get downloaded Whisper models"
        ) from e


@router.get("/local/models/available")
async def get_available_llm_models():
    """Get list of available pre-configured LLM models."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
        )

    try:
        models = llama_model_manager.get_available_models()
        return {"models": models}
    except Exception as e:
        logging.error(f"Error getting available models: {e}")
        raise HTTPException(status_code=500, detail="Failed to get available models") from e


@router.get("/local/models")
async def get_downloaded_llm_models():
    """Get list of downloaded local models."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
        )

    try:
        models = llama_model_manager.get_downloaded_models()
        return {"models": models}
    except Exception as e:
        logging.error(f"Error getting downloaded models: {e}")
        raise HTTPException(status_code=500, detail="Failed to get downloaded models") from e


@router.post("/local/models/download")
async def download_llm_model(
    request: dict = Body(..., description="Model ID or repo_id/filename.gguf"),
):
    """Download a model. Replaces any existing model (1 model at a time).

    model_id can be:
    - A pre-configured model ID like "qwen3-4b"
    - A custom model in format "repo_id/filename.gguf"
    """
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
        )

    model_id = request.get("model_id")
    if not model_id:
        raise HTTPException(status_code=422, detail="model_id is required")

    try:
        downloaded_path = await llama_model_manager.download_model(model_id)

        # Get file info for response
        file_size = Path(downloaded_path).stat().st_size
        file_size_mb = round(file_size / (1024 * 1024), 2)
        actual_filename = Path(downloaded_path).name

        return {
            "message": "Model downloaded successfully",
            "model_id": model_id,
            "filename": actual_filename,
            "path": downloaded_path,
            "size_mb": file_size_mb,
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logging.error(f"Error downloading model {model_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download model: {str(e)}") from e


@router.get("/local/models/download/stream")
async def download_llm_model_stream(model_id: str):
    """Stream download progress for LLM model using SSE.

    model_id can be:
    - A pre-configured model ID like "qwen3-4b"
    - A custom model in format "repo_id/filename.gguf" (URL encoded)
    """
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
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
            llama_model_manager.download_model(model_id, progress_callback=progress_callback)
        )

        # Send start event
        yield f"data: {json.dumps({'type': 'start', 'model_id': model_id})}\n\n"

        try:
            while not download_task.done():
                try:
                    progress = await asyncio.wait_for(queue.get(), timeout=0.5)
                    yield f"data: {json.dumps(progress)}\n\n"
                except TimeoutError:
                    # Send keepalive to prevent connection timeout
                    yield ": keepalive\n\n"

            # Get final result
            downloaded_path = await download_task

            # Get file info for response
            file_size = Path(downloaded_path).stat().st_size
            file_size_mb = round(file_size / (1024 * 1024), 2)
            actual_filename = Path(downloaded_path).name

            yield f"data: {json.dumps({'type': 'complete', 'path': downloaded_path, 'filename': actual_filename, 'size_mb': file_size_mb})}\n\n"

        except ValueError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        except Exception as e:
            logging.error(f"Download error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.delete("/local/models/{filename:path}")
async def delete_llm_model(filename: str):
    """Delete a downloaded local model."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
        )

    try:
        success = llama_model_manager.delete_model(filename)
        if success:
            return {"message": "Model deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Model not found")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting model {filename}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete model") from e


@router.get("/local/status")
async def get_local_model_status():
    """Get status using bundled llama-server."""
    if IS_DOCKER:
        return {
            "available": False,
            "llama_server_running": False,
            "models": [],
            "models_count": 0,
            "selected_model_id": None,
            "is_docker": True,
            "reason": "Local models are only available in Tauri builds",
        }

    models = llama_model_manager.get_downloaded_models()
    selected_model_id = llama_model_manager.get_selected_model_id()

    return {
        "available": len(models) > 0,
        "llama_server_running": True,  # Assume running since we started it
        "models": models,
        "models_count": len(models),
        "selected_model_id": selected_model_id,
        "is_docker": False,
    }


@router.get("/local/selected-model")
async def get_selected_model():
    """Get the currently selected local model ID."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
        )

    selected_model_id = llama_model_manager.get_selected_model_id()
    return {
        "selected_model_id": selected_model_id,
    }


@router.get("/local/model-recommendations")
async def get_model_recommendations():
    """Get model recommendations based on system capabilities."""
    # Return the pre-configured models as recommendations
    models = llama_model_manager.get_available_models()
    return {"models": models}
