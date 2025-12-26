import asyncio
import logging

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from server.database.config.manager import config_manager

router = APIRouter()


@router.get("/global")
async def get_config():
    """Retrieve the current global configuration."""
    return JSONResponse(content=config_manager.get_config())


@router.post("/global")
async def update_config(data: dict = Body(...)):
    """Update other configuration items with provided data."""
    config_manager.update_config(data)

    # After saving, kick off a background probe for PRIMARY_MODEL if it changed
    try:
        from server.utils.model_probe import probe_and_store_model_behavior

        updated = config_manager.get_config()
        provider = updated.get("LLM_PROVIDER", "ollama")
        base_url = updated.get("LLM_BASE_URL")
        api_key = updated.get("LLM_API_KEY")

        # Define models to check - only include REASONING_MODEL if reasoning is enabled
        models_to_check = ["PRIMARY_MODEL", "SECONDARY_MODEL"]
        if updated.get("REASONING_ENABLED", False):
            models_to_check.append("REASONING_MODEL")

        for key in models_to_check:
            model = updated.get(key)
            if model and provider:
                asyncio.create_task(
                    probe_and_store_model_behavior(
                        provider, base_url, api_key, model
                    )
                )
    except Exception as e:
        logging.warning(f"Failed to schedule model probe: {e}")

    return {"message": "config.js updated successfully"}
