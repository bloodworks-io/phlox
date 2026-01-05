"""
Whisper model management API endpoints.

Provides endpoints for downloading, listing, and deleting Whisper models.
"""

import logging

from fastapi import APIRouter, Body, HTTPException

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
    """Get Whisper model recommendations based on system capabilities.

    Returns recommendations for different use cases.
    """
    model_recommendations = [
        {
            "id": "tiny.en",
            "name": "tiny.en",
            "display_name": "Tiny English-only",
            "size": "39MB",
            "min_ram_gb": 1,
            "recommended_ram_gb": 2,
            "description": "Fastest transcription, good for real-time",
            "category": "tiny",
            "quality": "Basic",
            "speed": "Very Fast",
        },
        {
            "id": "base.en",
            "name": "base.en",
            "display_name": "Base English-only",
            "size": "74MB",
            "min_ram_gb": 1,
            "recommended_ram_gb": 2,
            "description": "Good balance of speed and accuracy",
            "category": "base",
            "quality": "Good",
            "speed": "Fast",
            "recommended": True,
        },
        {
            "id": "small.en",
            "name": "small.en",
            "display_name": "Small English-only",
            "size": "244MB",
            "min_ram_gb": 2,
            "recommended_ram_gb": 4,
            "description": "Better accuracy, still fast",
            "category": "small",
            "quality": "Very Good",
            "speed": "Moderate",
        },
        {
            "id": "medium.en",
            "name": "medium.en",
            "display_name": "Medium English-only",
            "size": "769MB",
            "min_ram_gb": 4,
            "recommended_ram_gb": 8,
            "description": "High accuracy for clinical use",
            "category": "medium",
            "quality": "Excellent",
            "speed": "Slower",
        },
        {
            "id": "large-v3",
            "name": "large-v3",
            "display_name": "Large V3 (Latest)",
            "size": "1.5GB",
            "min_ram_gb": 8,
            "recommended_ram_gb": 16,
            "description": "Best accuracy, multilingual support",
            "category": "large",
            "quality": "Outstanding",
            "speed": "Slow",
        },
    ]

    return {"models": model_recommendations}
