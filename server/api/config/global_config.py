import logging

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from server.database.config.manager import config_manager

router = APIRouter()


SENSITIVE_KEYS = {"LLM_API_KEY", "WHISPER_KEY"}
MASK_BULLET = "•"


def mask_key(key):
    """Partially mask a secret for display: first 3 + bullets + last 4."""
    if not key:
        return key
    if len(key) < 12:
        return MASK_BULLET * len(key)
    return key[:3] + MASK_BULLET * 4 + key[-4:]


@router.get("/global")
async def get_config():
    """Retrieve the current global configuration."""
    config = config_manager.get_config()
    masked = dict(config)
    for sensitive_key in SENSITIVE_KEYS:
        if sensitive_key in masked:
            masked[sensitive_key] = mask_key(masked[sensitive_key])
    return JSONResponse(content=masked)


@router.post("/global")
async def update_config(data: dict = Body(...)):
    """Update other configuration items with provided data.

    Sensitive key fields containing mask bullets (•) are stripped to avoid
    overwriting the stored secret with a masked display value.
    """
    filtered = dict(data)
    for sensitive_key in SENSITIVE_KEYS:
        if sensitive_key in filtered and MASK_BULLET in str(filtered[sensitive_key]):
            del filtered[sensitive_key]

    config_manager.update_config(filtered)

    try:
        from server.utils.rag.vector_store import get_vector_store_manager

        vector_store_mgr = get_vector_store_manager()
        if vector_store_mgr is not None:
            vector_store_mgr._reload_embedding_function()
    except Exception:
        logging.debug("Vector store reload skipped during config update")

    return {"message": "config.js updated successfully"}
