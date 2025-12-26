import logging

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from server.constants import IS_DOCKER
from server.database.config.manager import config_manager
from server.utils.llm_client.manager import LocalModelManager

router = APIRouter()


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
                models = await model_manager.list_models()
                return {"models": [model["name"] for model in models]}
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
