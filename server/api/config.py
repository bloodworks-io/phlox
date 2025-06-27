from fastapi import APIRouter, Query, Path, Body
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
import httpx
from server.database.config import config_manager
from server.utils.llm_client import LocalModelManager
from server.constants import IS_DOCKER
import logging
import re
import os
import json
from typing import Optional, List, Dict, Any

router = APIRouter()


@router.get("/prompts")
async def get_prompts():
    """Retrieve the current prompts configuration."""
    return JSONResponse(content=config_manager.get_prompts())


@router.post("/prompts")
async def update_prompts(data: dict):
    """Update prompts configuration with provided data."""
    config_manager.update_prompts(data)
    return {"message": "prompts.js updated successfully"}


@router.get("/global")
async def get_config():
    """Retrieve the current global configuration."""
    return JSONResponse(content=config_manager.get_config())


@router.post("/global")
async def update_config(data: dict):
    """Update other configuration items with provided data."""
    config_manager.update_config(data)
    return {"message": "config.js updated successfully"}


@router.get("/validate-url")
async def validate_url(
    url: str = Query(..., description="URL to validate"),
    type: str = Query(
        ..., description="Type of URL (whisper, ollama, or openai)"
    ),
):
    """Validate if a URL is accessible and returns a valid response."""
    try:
        async with httpx.AsyncClient() as client:
            if type == "whisper":
                # For Whisper, try to access the audio/transcriptions endpoint with a minimal request
                validate_url = f"{url}/v1/audio/transcriptions"

                # Prepare a minimal form data with empty file
                headers = {}
                form_data = {"model": "whisper-1"}
                try:
                    response = await client.post(
                        validate_url,
                        data=form_data,
                        headers=headers,
                        timeout=3.0,
                    )

                    # If we get a 400, it means the endpoint exists but our request was invalid (which is expected)
                    # Or if we get a 401, it means the endpoint exists but requires authentication
                    # Or if we get a 422, it means the endpoint exists but our request was invalid (which is expected)
                    if response.status_code in [400, 401, 403, 422]:
                        return {"valid": True}
                    elif response.status_code == 200:
                        return {"valid": True}
                    else:
                        return {
                            "valid": False,
                            "status_code": response.status_code,
                        }
                except Exception as e:
                    # If we get a connection error, the URL might be wrong
                    logging.error(f"Error validating Whisper URL: {str(e)}")
                    return {
                        "valid": False,
                        "error": "An internal error has occurred while validating the URL.",
                    }
            elif type == "ollama":
                # For Ollama, try to access the tags endpoint
                validate_url = f"{url}/api/tags"
                response = await client.get(validate_url, timeout=3.0)
                return {"valid": response.status_code == 200}
            elif type == "openai":
                # For OpenAI-compatible, try to access the models endpoint
                validate_url = f"{url}/v1/models"
                try:
                    response = await client.get(validate_url, timeout=3.0)
                    # Most OpenAI-compatible endpoints will return 401 without auth
                    return {
                        "valid": response.status_code in [200, 401, 403, 404]
                    }
                except:
                    # If models endpoint doesn't exist, try a different endpoint
                    validate_url = f"{url}/v1/chat/completions"
                    try:
                        response = await client.post(
                            validate_url,
                            json={"model": "test", "messages": []},
                            timeout=3.0,
                        )
                        return {
                            "valid": response.status_code
                            in [200, 401, 403, 404, 422]
                        }
                    except:
                        return {"valid": False}
            else:
                raise HTTPException(status_code=400, detail="Invalid URL type")

    except Exception as e:
        logging.error(f"Error validating URL: {str(e)}")
        return {
            "valid": False,
            "error": "An internal error has occurred while validating the URL.",
        }


@router.get("/ollama")
async def get_all_options():
    """Retrieve all Ollama-related configuration options."""
    return JSONResponse(content=config_manager.get_all_options())


@router.get("/llm/models")
async def get_llm_models(
    provider: str = Query(
        ..., description="LLM provider type (ollama, openai, or local)"
    ),
    baseUrl: str = Query(None, description="The base URL for the LLM API"),
    apiKey: str = Query(None, description="API key (required for OpenAI)"),
):
    """Fetch available models from the configured LLM provider."""
    try:
        if provider.lower() == "local":
            # For local models, return downloaded models
            if IS_DOCKER:
                return {
                    "models": [],
                    "error": "Local models not available in Docker",
                }

            try:
                model_manager = LocalModelManager()
                models_dir = model_manager.models_dir

                if not models_dir.exists():
                    return {"models": []}

                models = []
                for model_file in models_dir.iterdir():
                    if model_file.suffix.lower() == ".gguf":
                        models.append({model_file.name})
                return {"models": models}
            except Exception as e:
                logging.error(f"Error fetching local models: {e}")
                return {"models": [], "error": "Failed to fetch local models"}

        elif provider.lower() == "ollama":
            if not baseUrl:
                raise HTTPException(
                    status_code=400, detail="baseUrl is required for Ollama"
                )

            async with httpx.AsyncClient() as client:
                url = f"{baseUrl}/api/tags"
                response = await client.get(url, timeout=5.0)

                if response.status_code == 200:
                    return response.json()
                else:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail="Failed to fetch Ollama models",
                    )

        elif provider.lower() == "openai":
            if not baseUrl:
                raise HTTPException(
                    status_code=400, detail="baseUrl is required for OpenAI"
                )

            # For OpenAI-compatible endpoints
            headers = {"Authorization": f"Bearer {apiKey}"} if apiKey else {}

            async with httpx.AsyncClient(headers=headers) as client:
                url = f"{baseUrl}/v1/models"
                try:
                    response = await client.get(url, timeout=5.0)

                    if response.status_code == 200:
                        data = response.json()
                        model_list = []

                        # Extract model names from response
                        if isinstance(data, dict) and "data" in data:
                            model_list = [
                                model.get("id") for model in data["data"]
                            ]

                        return {"models": model_list}
                    elif response.status_code in [401, 403]:
                        # Authentication issue - likely valid URL but bad/missing API key
                        return {"models": [], "error": "Authentication failed"}
                    else:
                        # Some OpenAI-compatible APIs may not support model listing
                        # Return empty list in this case
                        return {"models": []}
                except:
                    # Endpoint might not be available, return empty list
                    return {"models": []}

        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported provider type. Must be 'ollama', 'openai', or 'local'",
            )

    except Exception as e:
        logging.error(f"Error fetching LLM models: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/ollama/{category}")
async def get_options_by_category(
    category: str = Path(..., description="The category of options to retrieve")
):
    """Retrieve options by category"""
    options = config_manager.get_options(category)
    if options:
        return JSONResponse(content=options)
    else:
        raise HTTPException(
            status_code=404, detail=f"No options found for category: {category}"
        )


@router.post("/ollama/{category}")
async def update_options(
    category: str = Path(..., description="The category of options to update"),
    data: dict = Body(...),
):
    """Update configuration options for the specified category."""
    config_manager.update_options(category, data)
    return {
        "message": f"Options for category '{category}' updated successfully"
    }


@router.get("/ollama/models")
async def get_models(
    ollamaEndpoint: str = Query(..., description="The endpoint for Ollama")
):
    """Fetch model tags from the configured Ollama endpoint."""
    try:
        async with httpx.AsyncClient() as client:
            url = f"{ollamaEndpoint}/api/tags"
            logging.info(f"Fetching Ollama models from: {url}")
            response = await client.get(url)

            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch models",
                )

    except Exception as e:
        logging.error(f"Error fetching models: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/whisper/models")
async def get_whisper_models(
    whisperEndpoint: str = Query(
        ..., description="The endpoint for Whisper API"
    )
):
    """Fetch available Whisper models from the configured endpoint. Only works if the instance has a /v1/models endpoint (eg Speaches); otherwise returns an empty list"""
    try:
        # First try to fetch models from the endpoint
        async with httpx.AsyncClient() as client:
            try:
                url = f"{whisperEndpoint}/v1/models"
                response = await client.get(url, timeout=5.0)

                if response.status_code == 200:
                    # Parse the response based on the expected format
                    data = response.json()
                    # Extract model names depending on the API structure
                    models = []
                    if isinstance(data, list):
                        models = [
                            model.get("id", model.get("name", ""))
                            for model in data
                            if "whisper" in str(model).lower()
                        ]
                    elif isinstance(data, dict) and "data" in data:
                        models = [
                            model.get("id", model.get("name", ""))
                            for model in data["data"]
                            if "whisper" in str(model).lower()
                        ]

                    # If we found some models, return them
                    if models:
                        return {"models": models, "listAvailable": True}
            except Exception as e:
                logging.warning(
                    f"Could not fetch Whisper models from endpoint: {e}"
                )

        # If we couldn't get models from the API or none were found,
        # indicate that no model list is available
        return {"models": [], "listAvailable": False}

    except Exception as e:
        logging.error(f"Error in get_whisper_models: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/reset-to-defaults")
async def reset_to_defaults():
    """Reset configuration settings to their default values."""
    config_manager.reset_to_defaults()
    return {"message": "All configurations reset to defaults"}


@router.get("/user")
async def get_user_settings():
    """Retrieve the current user settings."""
    return JSONResponse(content=config_manager.get_user_settings())


@router.post("/user")
async def update_user_settings(data: dict):
    """Update user settings with provided data."""
    config_manager.update_user_settings(data)
    return {"message": "User settings updated successfully"}


@router.post("/user/mark_splash_complete")
async def mark_splash_complete():
    """Mark the splash screen as completed for the current user."""
    current_settings = config_manager.get_user_settings()

    expected_keys = [
        "name",
        "specialty",
        "quick_chat_1_title",
        "quick_chat_1_prompt",
        "quick_chat_2_title",
        "quick_chat_2_prompt",
        "quick_chat_3_title",
        "quick_chat_3_prompt",
        "default_letter_template_id",
    ]
    for key in expected_keys:
        if key not in current_settings:
            # Apply same defaults as in get_user_settings's 'else' block or from original structure
            if key == "name" or key == "specialty":
                current_settings[key] = ""
            elif key == "quick_chat_1_title":
                current_settings[key] = "Critique my plan"
            elif key == "quick_chat_1_prompt":
                current_settings[key] = "Critique my plan"
            elif key == "quick_chat_2_title":
                current_settings[key] = "Any additional investigations"
            elif key == "quick_chat_2_prompt":
                current_settings[key] = "Any additional investigations"
            elif key == "quick_chat_3_title":
                current_settings[key] = "Any differentials to consider"
            elif key == "quick_chat_3_prompt":
                current_settings[key] = "Any differentials to consider"
            elif key == "default_letter_template_id":
                current_settings[key] = None

    current_settings["has_completed_splash_screen"] = True
    config_manager.update_user_settings(current_settings)
    return {"message": "Splash screen marked as completed."}


@router.get("/changelog")
async def get_changelog():
    """Retrieve the full changelog content."""
    try:
        path = "/usr/src/app/CHANGELOG.md"
        with open(path, "r") as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        logging.error(f"Error retrieving changelog: {str(e)}")
        return {"content": "Error retrieving changelog."}


@router.get("/version")
async def get_version():
    """Retrieve the current version of the application."""
    try:
        path = "/usr/src/app/CHANGELOG.md"
        with open(path, "r") as f:
            changelog = f.read()

        match = re.search(r"## \[(.*?)\].*?\n", changelog)
        if match:
            version = match.group(1)
            return {"version": version}
        else:
            logging.warning("Version number not found in CHANGELOG.md")
            return {"version": "unknown"}
    except Exception as e:
        logging.error(f"Error getting version from CHANGELOG.md: {str(e)}")
        return {"version": "unknown"}


@router.get("/status")
async def get_server_status():
    """Check the status of LLM and Whisper servers."""
    config = config_manager.get_config()
    status = {"llm": False, "whisper": False}

    try:
        # Check LLM provider
        provider_type = config.get("LLM_PROVIDER", "ollama").lower()
        base_url = config.get("LLM_BASE_URL")

        if base_url:
            async with httpx.AsyncClient() as client:
                try:
                    if provider_type == "ollama":
                        response = await client.get(
                            f"{base_url}/api/tags", timeout=2.0
                        )
                        status["llm"] = response.status_code == 200
                    elif provider_type == "openai":
                        response = await client.get(
                            f"{base_url}/v1/models", timeout=2.0
                        )
                        # If we get 401/403, the service exists but requires auth
                        status["llm"] = response.status_code in [200, 401, 403]
                except:
                    pass

        # Check Whisper
        if config.get("WHISPER_BASE_URL"):
            async with httpx.AsyncClient() as client:
                try:
                    # For Whisper, we only check if the URL is reachable
                    response = await client.get(
                        f"{config.get('WHISPER_BASE_URL')}/v1/models",
                        timeout=2.0,
                    )
                    # If we get a 401/403, the service exists but requires auth
                    status["whisper"] = response.status_code in [200, 401, 403]
                except:
                    pass

        return status
    except Exception as e:
        logging.error(f"Error checking server status: {str(e)}")
        return status

        return status
    except Exception as e:
        logging.error(f"Error checking server status: {str(e)}")
        return status


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
        models_dir = model_manager.models_dir

        if not models_dir.exists():
            return {"models": []}

        models = []
        for model_file in models_dir.iterdir():
            if model_file.suffix.lower() == ".gguf":
                file_size = model_file.stat().st_size
                models.append(
                    {
                        "filename": model_file.name,
                        "path": str(model_file),
                        "size": file_size,
                        "size_mb": round(file_size / (1024 * 1024), 2),
                    }
                )

        return {"models": models}
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
    """Get status of local model support."""
    if IS_DOCKER:
        return {
            "available": False,
            "reason": "Local models are only available in Tauri builds",
        }

    try:
        # Check if required dependencies are installed
        try:
            import llama_cpp

            llama_cpp_available = True
        except ImportError:
            llama_cpp_available = False

        try:
            import huggingface_hub

            hf_hub_available = True
        except ImportError:
            hf_hub_available = False

        model_manager = LocalModelManager()
        models_dir_exists = model_manager.models_dir.exists()

        return {
            "available": llama_cpp_available and hf_hub_available,
            "llama_cpp_installed": llama_cpp_available,
            "huggingface_hub_installed": hf_hub_available,
            "models_directory": str(model_manager.models_dir),
            "models_directory_exists": models_dir_exists,
        }

    except Exception as e:
        logging.error(f"Error checking local model status: {e}")
        return {
            "available": False,
            "reason": f"Error checking status: {str(e)}",
        }
