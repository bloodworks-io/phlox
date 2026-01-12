from fastapi import APIRouter
from fastapi.responses import JSONResponse

from server.database.config.defaults.prompts import DEFAULT_PROMPTS
from server.database.config.manager import config_manager

router = APIRouter()


@router.get("/prompts")
async def get_prompts():
    """Retrieve the current prompts configuration."""
    return JSONResponse(content=config_manager.get_prompts())


@router.get("/prompts/defaults")
async def get_default_prompts():
    """Return the default prompts configuration (not current values)."""
    return JSONResponse(content=DEFAULT_PROMPTS["prompts"])


@router.post("/prompts")
async def update_prompts(data: dict):
    """Update prompts configuration with provided data."""
    config_manager.update_prompts(data)
    return {"message": "prompts.js updated successfully"}
