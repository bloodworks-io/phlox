from fastapi import APIRouter
from fastapi.responses import JSONResponse

from server.database.config.manager import config_manager

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
