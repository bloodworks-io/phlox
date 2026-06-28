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

    try:
        from server.utils.rag.vector_store import get_vector_store_manager

        vector_store_mgr = get_vector_store_manager()
        if vector_store_mgr is not None:
            vector_store_mgr._reload_embedding_function()
    except Exception:
        logging.debug("Vector store reload skipped during config update")

    return {"message": "config.js updated successfully"}
