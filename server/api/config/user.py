from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from server.database.config.manager import config_manager

router = APIRouter()


@router.get("/user")
def get_user_settings():
    """Retrieve the current user settings."""
    return JSONResponse(content=config_manager.get_user_settings())


@router.post("/user")
def update_user_settings(data: dict = Body(...)):
    """Update user settings with provided data."""
    # disabled_tools / advanced_options relocated to config KV (migration v9).
    data.pop("disabled_tools", None)
    data.pop("advanced_options", None)
    data.pop("default_template_key", None)
    config_manager.update_user_settings(data)
    return {"message": "User settings updated successfully"}


@router.post("/user/mark_splash_complete")
def mark_splash_complete():
    """Mark the splash screen as completed for the current user."""
    config_manager.set_splash_completed()
    return {"message": "Splash screen marked as completed."}
