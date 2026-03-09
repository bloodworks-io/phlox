import logging

import httpx
from fastapi import APIRouter

router = APIRouter()


def _get_llm_status_url(config: dict) -> str | None:
    """Determine the LLM status check URL based on provider configuration."""
    provider_type = config.get("LLM_PROVIDER", "ollama").lower()
    base_url = config.get("LLM_BASE_URL")

    if provider_type == "local":
        from server.utils.allocated_ports import get_llama_port

        return f"http://127.0.0.1:{get_llama_port()}/v1/models"
    elif provider_type == "ollama":
        # Use configured URL or fall back to default Ollama port
        url = base_url or "http://127.0.0.1:11434"
        return f"{url}/api/tags"
    elif provider_type == "openai":
        # OpenAI-compatible API requires configured base URL
        if base_url:
            return f"{base_url}/v1/models"
        return None
    return None


def _get_whisper_status_url(config: dict) -> str | None:
    """Determine the Whisper status check URL based on configuration."""
    whisper_base_url = config.get("WHISPER_BASE_URL")

    # Check if using local whisper server (when LLM_PROVIDER is "local" and no external URL configured)
    if config.get("LLM_PROVIDER") == "local" and not whisper_base_url:
        from server.utils.allocated_ports import get_whisper_port

        return f"http://127.0.0.1:{get_whisper_port()}/v1/models"

    if whisper_base_url:
        return f"{whisper_base_url}/v1/models"

    return None


@router.get("/status")
async def get_server_status():
    """Check the status of LLM and Whisper servers."""
    from server.database.config.manager import config_manager

    config = config_manager.get_config()
    status = {"llm": False, "whisper": False}

    try:
        # Check LLM status
        llm_url = _get_llm_status_url(config)
        if llm_url:
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get(llm_url, timeout=2.0)
                    provider_type = config.get("LLM_PROVIDER", "ollama").lower()
                    if provider_type == "ollama":
                        status["llm"] = response.status_code == 200
                    else:
                        # For openai-compatible APIs (including local llama-server)
                        # If we get 401/403, the service exists but requires auth
                        status["llm"] = response.status_code in [200, 401, 403]
                except Exception:
                    pass

        # Check Whisper status
        whisper_url = _get_whisper_status_url(config)
        if whisper_url:
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get(whisper_url, timeout=2.0)
                    # If we get a 401/403, the service exists but requires auth
                    status["whisper"] = response.status_code in [200, 401, 403]
                except Exception:
                    pass

        return status
    except Exception as e:
        logging.error(f"Error checking server status: {str(e)}")
        return status
