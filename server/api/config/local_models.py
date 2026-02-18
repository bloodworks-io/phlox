import asyncio
import json
import logging
import os
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
        )


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
        raise HTTPException(
            status_code=500, detail="Failed to get available models"
        )


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
        raise HTTPException(
            status_code=500, detail="Failed to get downloaded models"
        )


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
        file_size = os.path.getsize(downloaded_path)
        file_size_mb = round(file_size / (1024 * 1024), 2)
        actual_filename = os.path.basename(downloaded_path)

        return {
            "message": "Model downloaded successfully",
            "model_id": model_id,
            "filename": actual_filename,
            "path": downloaded_path,
            "size_mb": file_size_mb,
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logging.error(f"Error downloading model {model_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to download model: {str(e)}"
        )


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
            llama_model_manager.download_model(
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

            # Get file info for response
            file_size = os.path.getsize(downloaded_path)
            file_size_mb = round(file_size / (1024 * 1024), 2)
            actual_filename = os.path.basename(downloaded_path)

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
        raise HTTPException(status_code=500, detail="Failed to delete model")


@router.get("/local/models/search")
async def search_huggingface_models(
    query: str = "gguf",
    limit: int = 20,
):
    """Search for GGUF models on Hugging Face Hub."""
    try:
        from huggingface_hub import HfApi

        api = HfApi()

        # Search for models with GGUF in the name or tags
        models = api.list_models(
            search=f"{query} gguf", limit=limit, sort="downloads", direction=-1
        )

        results = []
        for model in models:
            # Get basic model info
            model_info = {
                "repo_id": model.id,
                "author": model.author,
                "downloads": getattr(model, "downloads", 0),
                "likes": getattr(model, "likes", 0),
                "tags": getattr(model, "tags", []),
                "description": getattr(model, "description", ""),
            }

            # Try to get GGUF files for this model
            try:
                files = api.list_repo_files(model.id)
                gguf_files = [f for f in files if f.endswith(".gguf")]
                model_info["gguf_files"] = gguf_files[:10]
                model_info["has_gguf"] = len(gguf_files) > 0
            except:
                model_info["gguf_files"] = []
                model_info["has_gguf"] = False

            # Only include models that have GGUF files
            if model_info["has_gguf"]:
                results.append(model_info)

        return {"models": results}

    except ImportError:
        raise HTTPException(
            status_code=500, detail="huggingface_hub not installed"
        )
    except Exception as e:
        logging.error(f"Error searching models: {e}")
        raise HTTPException(status_code=500, detail="Failed to search models")


@router.get("/local/models/repo/{repo_id:path}")
async def get_repo_gguf_files(repo_id: str):
    """Get GGUF files available in a specific repository."""
    try:
        from huggingface_hub import list_repo_files

        files = list_repo_files(repo_id)
        gguf_files = [f for f in files if f.endswith(".gguf")]

        # Organize by quantization type
        quantizations = {}
        for file in gguf_files:
            # Extract quantization info from filename
            filename_lower = file.lower()
            if "q4_k_m" in filename_lower:
                quant_type = "Q4_K_M"
            elif "q4_0" in filename_lower:
                quant_type = "Q4_0"
            elif "q5_k_m" in filename_lower:
                quant_type = "Q5_K_M"
            elif "q6_k" in filename_lower:
                quant_type = "Q6_K"
            elif "q8_0" in filename_lower:
                quant_type = "Q8_0"
            elif "f16" in filename_lower:
                quant_type = "F16"
            elif "f32" in filename_lower:
                quant_type = "F32"
            else:
                quant_type = "Other"

            if quant_type not in quantizations:
                quantizations[quant_type] = []
            quantizations[quant_type].append(file)

        return {
            "repo_id": repo_id,
            "gguf_files": gguf_files,
            "quantizations": quantizations,
        }

    except ImportError:
        raise HTTPException(
            status_code=500, detail="huggingface_hub not installed"
        )
    except Exception as e:
        logging.error(f"Error getting repo files for {repo_id}: {e}")
        raise HTTPException(
            status_code=404,
            detail="Repository not found or error accessing files",
        )


@router.get("/local/status")
async def get_local_model_status():
    """Get status using bundled llama-server."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
        )

    models = llama_model_manager.get_downloaded_models()
    selected_model_id = llama_model_manager.get_selected_model_id()

    return {
        "available": len(models) > 0,
        "llama_server_running": True,  # Assume running since we started it
        "models": models,
        "models_count": len(models),
        "selected_model_id": selected_model_id,
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
