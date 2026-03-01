import logging

import httpx
from fastapi import APIRouter

router = APIRouter()


@router.get("/status")
async def get_server_status():
    """Check the status of LLM and Whisper servers."""
    from server.database.config.manager import config_manager

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
