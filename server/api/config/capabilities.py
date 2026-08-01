"""Capabilities endpoint mostly for language items.
"""

from fastapi import APIRouter

from server.database.config.manager import config_manager
from server.utils.whisper_models import whisper_model_manager

router = APIRouter()


@router.get("/capabilities")
async def get_capabilities():
    """Report transcription language capabilities for the active configuration."""
    config = config_manager.get_config()
    is_local = config.get("LLM_PROVIDER") == "local" and not config.get("WHISPER_BASE_URL")

    if is_local:
        stt_languages = whisper_model_manager.get_active_model_languages()
    else:
        # Remote endpoint: assume multilingual.
        stt_languages = ["*"]

    return {
        "stt_mode": "local" if is_local else "remote",
        "stt_languages": stt_languages,
    }
