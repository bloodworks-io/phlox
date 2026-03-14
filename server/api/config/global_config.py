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
        from server.utils.rag.chroma import get_chroma_manager

        chroma_mgr = get_chroma_manager()
        if chroma_mgr is not None:
            chroma_mgr._reload_embedding_function()
    except Exception:
        # Silently ignore if RAG is not available or configured
        pass

    return {"message": "config.js updated successfully"}
