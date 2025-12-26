import logging

import httpx
from fastapi import APIRouter, Body, Path
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse

from server.database.config.manager import config_manager

router = APIRouter()


@router.get("/ollama")
async def get_all_options():
    """Retrieve all Ollama-related configuration options."""
    return JSONResponse(content=config_manager.get_all_options())


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
async def get_ollama_models(
    ollamaEndpoint: str = ...,
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
