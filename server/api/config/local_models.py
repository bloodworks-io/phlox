import logging
import os
from pathlib import Path

import httpx
from fastapi import APIRouter, Body, Path, Query
from fastapi.exceptions import HTTPException

from server.constants import IS_DOCKER
from server.utils.llm_client.manager import LocalModelManager

router = APIRouter()


@router.get("/local/models")
async def get_local_models():
    """Get list of downloaded local models."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
        )

    try:
        model_manager = LocalModelManager()
        models = await model_manager.list_models()

        formatted_models = []
        for model in models:
            formatted_models.append(
                {
                    "name": model["name"],
                    "size": model.get("size", 0),
                    "modified_at": model.get("modified_at", ""),
                }
            )

        return {"models": formatted_models}

    except Exception as e:
        logging.error(f"Error getting local models: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get local models"
        )


@router.post("/local/models/download")
async def download_local_model(
    repo_id: str = Body(..., description="Hugging Face repository ID"),
    filename: str = Body(
        None, description="Specific filename to download (optional)"
    ),
    quantization: str = Body(
        "Q4_K_M", description="Quantization level (default: Q4_K_M)"
    ),
):
    """Download a model from Hugging Face Hub."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
        )

    try:
        model_manager = LocalModelManager()

        # Use the enhanced download_model method
        downloaded_path = await model_manager.download_model(
            repo_id=repo_id, filename=filename, quantization=quantization
        )

        # Get file info for response
        file_size = os.path.getsize(downloaded_path)
        file_size_mb = round(file_size / (1024 * 1024), 2)

        # Extract the actual filename from the path if it was auto-detected
        actual_filename = os.path.basename(downloaded_path)

        return {
            "message": "Model downloaded successfully",
            "repo_id": repo_id,
            "filename": actual_filename,
            "path": downloaded_path,
            "size_mb": file_size_mb,
        }

    except ValueError as e:
        # Handle specific errors like repository not found, no GGUF files, etc.
        raise HTTPException(status_code=404, detail=str(e))
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logging.error(f"Error downloading model {repo_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to download model: {str(e)}"
        )


@router.delete("/local/models")
async def delete_local_model(
    repo_id: str = Query(..., description="Repository ID"),
    filename: str = Query(..., description="Model filename"),
):
    """Delete a downloaded local model."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
        )

    try:
        model_manager = LocalModelManager()
        model_path = Path(model_manager.get_model_path(repo_id, filename))

        if not model_path.exists():
            raise HTTPException(status_code=404, detail="Model not found")

        # Delete the model file
        model_path.unlink()

        # If the directory is empty, remove it too
        if model_path.parent.is_dir() and not any(model_path.parent.iterdir()):
            model_path.parent.rmdir()

        return {"message": "Model deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting model {repo_id}/{filename}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete model")


@router.get("/local/models/search")
async def search_huggingface_models(
    query: str = Query(..., description="Search query"),
    limit: int = Query(20, description="Maximum number of results"),
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
                model_info["gguf_files"] = gguf_files[
                    :10
                ]  # Limit to first 10 files
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
    """Get status using bundled Ollama."""
    if IS_DOCKER:
        raise HTTPException(
            status_code=400,
            detail="Local models are only available in Tauri builds",
        )

    manager = LocalModelManager()
    models = await manager.list_models()

    return {
        "available": len(models) > 0,
        "ollama_running": True,  # Assume running since we started it
        "models": models,
        "models_count": len(models),
    }


@router.get("/local/model-recommendations")
async def get_model_recommendations():
    """Get model recommendations based on system capabilities"""

    model_recommendations = [
        {
            "name": "qwen3:0.6b",
            "display_name": "Qwen3 0.6B (Small)",
            "size": "523MB",
            "min_ram_gb": 1,
            "recommended_ram_gb": 2,
            "description": "Fastest responses, good for basic tasks",
            "category": "small",
            "quality": "Basic",
            "speed": "Very Fast",
        },
        {
            "name": "qwen3:1.7b",
            "display_name": "Qwen3 1.7B (Small)",
            "size": "1.4GB",
            "min_ram_gb": 2,
            "recommended_ram_gb": 4,
            "description": "Good balance of speed and quality for most tasks",
            "category": "small",
            "quality": "Good",
            "speed": "Fast",
        },
        {
            "name": "qwen3:4b",
            "display_name": "Qwen3 4B (Medium)",
            "size": "2.6GB",
            "min_ram_gb": 4,
            "recommended_ram_gb": 8,
            "description": "Better quality responses, moderate speed",
            "category": "medium",
            "quality": "Very Good",
            "speed": "Moderate",
        },
        {
            "name": "qwen3:8b",
            "display_name": "Qwen3 8B (Medium)",
            "size": "5.2GB",
            "min_ram_gb": 6,
            "recommended_ram_gb": 12,
            "description": "High quality responses, recommended for most users",
            "category": "medium",
            "quality": "Excellent",
            "speed": "Moderate",
        },
        {
            "name": "qwen3:14b",
            "display_name": "Qwen3 14B (Large)",
            "size": "9.3GB",
            "min_ram_gb": 12,
            "recommended_ram_gb": 16,
            "description": "Very high quality responses, slower generation",
            "category": "large",
            "quality": "Outstanding",
            "speed": "Slow",
        },
        {
            "name": "qwen3:30b",
            "display_name": "Qwen3 30B (Large)",
            "size": "19GB",
            "min_ram_gb": 24,
            "recommended_ram_gb": 32,
            "description": "Exceptional quality, requires high-end hardware",
            "category": "large",
            "quality": "Exceptional",
            "speed": "Very Slow",
        },
        {
            "name": "qwen3:32b",
            "display_name": "Qwen3 32B (Large)",
            "size": "20GB",
            "min_ram_gb": 24,
            "recommended_ram_gb": 32,
            "description": "Top-tier quality, requires high-end hardware",
            "category": "large",
            "quality": "Exceptional",
            "speed": "Very Slow",
        },
    ]

    return {"models": model_recommendations}


@router.post("/local/pull-ollama-model")
async def pull_ollama_model(request: dict):
    """Pull a model using Ollama"""
    model_name = request.get("model_name")
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name is required")

    from server.utils.local_ollama import LocalOllamaClient

    async with LocalOllamaClient() as client:
        success = await client.pull_model(model_name)
        if success:
            return {
                "message": f"Successfully pulled model {model_name}",
                "success": True,
            }
        else:
            raise HTTPException(
                status_code=500, detail=f"Failed to pull model {model_name}"
            )


@router.get("/local/list")
async def list_ollama_models():
    """List all Ollama models"""
    from server.utils.local_ollama import LocalOllamaClient

    async with LocalOllamaClient() as client:
        return await client.list_models()
