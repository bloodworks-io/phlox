from fastapi import APIRouter, Query, Path, Body
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
import httpx
from server.database.config import config_manager
import logging

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
    type: str = Query(..., description="Type of URL (whisper or ollama)")
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
                    response = await client.post(validate_url, data=form_data, headers=headers, timeout=3.0)
                    print(response, flush=True)
                    # If we get a 400, it means the endpoint exists but our request was invalid (which is expected)
                    # Or if we get a 401, it means the endpoint exists but requires authentication
                    # Or if we get a 422, it means the endpoint exists but our request was invalid (which is expected)
                    if response.status_code in [400, 401, 403, 422]:
                        return {"valid": True}
                    elif response.status_code == 200:
                        return {"valid": True}
                    else:
                        return {"valid": False, "status_code": response.status_code}
                except Exception as e:
                    # If we get a connection error, the URL might be wrong
                    return {"valid": False, "error": str(e)}
            elif type == "ollama":
                # For Ollama, try to access the tags endpoint
                validate_url = f"{url}/api/tags"
            else:
                raise HTTPException(status_code=400, detail="Invalid URL type")

            response = await client.get(validate_url, timeout=3.0)
            if response.status_code == 200:
                return {"valid": True}
            else:
                return {"valid": False, "status_code": response.status_code}

    except Exception as e:
        logging.error(f"Error validating URL: {e}")
        return {"valid": False, "error": str(e)}

@router.get("/ollama")
async def get_all_options():
    """Retrieve all Ollama-related configuration options."""
    return JSONResponse(content=config_manager.get_all_options())

@router.get("/ollama/models")
async def get_models(
    ollamaEndpoint: str = Query(..., description="The endpoint for Ollama")
):
    """Fetch model tags from the configured Ollama endpoint."""
    try:
        async with httpx.AsyncClient() as client:
            url = f"{ollamaEndpoint}/api/tags"
            print(url)
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
            print(url)
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
    whisperEndpoint: str = Query(..., description="The endpoint for Whisper API")
):
    """Fetch available Whisper models from the configured endpoint."""
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
                        models = [model.get('id', model.get('name', '')) for model in data if 'whisper' in str(model).lower()]
                    elif isinstance(data, dict) and 'data' in data:
                        models = [model.get('id', model.get('name', '')) for model in data['data'] if 'whisper' in str(model).lower()]

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


@router.get("/user")
async def get_user_settings():
    """Retrieve the current user settings."""
    return JSONResponse(content=config_manager.get_user_settings())


@router.post("/user")
async def update_user_settings(data: dict):
    """Update user settings with provided data."""
    config_manager.update_user_settings(data)
    return {"message": "User settings updated successfully"}
