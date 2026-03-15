import logging

import httpx
from fastapi import APIRouter, Body, HTTPException, Query
from fastapi.responses import JSONResponse

from server.constants import IS_DOCKER
from server.database.config.manager import config_manager
from server.utils.llm_client.manager import LocalModelManager
from server.utils.url_utils import build_openai_v1_url, build_whisper_v1_url

router = APIRouter()


@router.get("/options")
async def get_options():
    """Retrieve all options configuration."""
    prompts_and_options = config_manager.get_prompts_and_options()
    return JSONResponse(content=prompts_and_options["options"])


@router.post("/options/{category}")
async def update_options(category: str, data: dict = Body(...)):
    """Update options for a specific category."""
    config_manager.update_options(category, data)
    return {"message": f"{category} options updated successfully"}


@router.get("/llm/models")
async def get_llm_models(
    provider: str = Query(..., description="LLM provider type (openai or local)"),
    baseUrl: str = Query(None, description="The base URL for the LLM API"),
    apiKey: str = Query(None, description="Optional API key for authenticated OpenAI-compatible endpoints"),
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

        elif provider.lower() == "openai":
            if not baseUrl:
                raise HTTPException(
                    status_code=400,
                    detail="baseUrl is required for OpenAI-compatible providers",
                )

            headers = {"Authorization": f"Bearer {apiKey}"} if apiKey else {}

            async with httpx.AsyncClient(headers=headers) as client:
                url = build_openai_v1_url(baseUrl, "models")
                try:
                    response = await client.get(url, timeout=5.0)

                    if response.status_code == 200:
                        data = response.json()
                        model_list = []

                        # Be tolerant of common OpenAI-compatible response shapes
                        if isinstance(data, dict):
                            if isinstance(data.get("data"), list):
                                for model in data["data"]:
                                    if isinstance(model, dict):
                                        model_id = model.get("id") or model.get("name")
                                        if model_id:
                                            model_list.append(model_id)
                                    elif isinstance(model, str):
                                        model_list.append(model)

                            elif isinstance(data.get("models"), list):
                                for model in data["models"]:
                                    if isinstance(model, dict):
                                        model_id = model.get("id") or model.get("name")
                                        if model_id:
                                            model_list.append(model_id)
                                    elif isinstance(model, str):
                                        model_list.append(model)

                            # Rare but valid shape: {"id": "..."} or {"name": "..."}
                            elif data.get("id") or data.get("name"):
                                model_list.append(data.get("id") or data.get("name"))

                        elif isinstance(data, list):
                            for model in data:
                                if isinstance(model, dict):
                                    model_id = model.get("id") or model.get("name")
                                    if model_id:
                                        model_list.append(model_id)
                                elif isinstance(model, str):
                                    model_list.append(model)

                        # Deduplicate while preserving order
                        model_list = list(dict.fromkeys(model_list))

                        return {"models": model_list}
                    elif response.status_code in [401, 403]:
                        # Authentication issue - likely valid URL but bad/missing API key
                        return {"models": [], "error": "Authentication failed"}
                    else:
                        # Some OpenAI-compatible APIs may not support model listing
                        return {"models": []}
                except Exception:
                    # Endpoint might not be available, return empty list
                    return {"models": []}

        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported provider type. Must be 'openai' or 'local'",
            )

    except Exception as e:
        logging.error(f"Error fetching LLM models: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/whisper/models")
async def get_whisper_models(
    whisperEndpoint: str = Query(..., description="The endpoint for Whisper API"),
):
    """Fetch available Whisper models from the configured endpoint.

    Accepts endpoints with or without a terminal /v1 segment.
    Only works if the instance exposes a compatible /v1/models endpoint
    (e.g. Speaches); otherwise returns an empty list.
    """
    try:
        # First try to fetch models from the endpoint
        async with httpx.AsyncClient() as client:
            try:
                url = build_whisper_v1_url(whisperEndpoint, "models")
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
                logging.warning(f"Could not fetch Whisper models from endpoint: {e}")

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
