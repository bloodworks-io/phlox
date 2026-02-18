from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from server.database.config.manager import config_manager

router = APIRouter()


@router.get("/user")
async def get_user_settings():
    """Retrieve the current user settings."""
    return JSONResponse(content=config_manager.get_user_settings())


@router.post("/user")
async def update_user_settings(data: dict = Body(...)):
    """Update user settings with provided data."""
    config_manager.update_user_settings(data)
    return {"message": "User settings updated successfully"}


@router.post("/user/mark_splash_complete")
async def mark_splash_complete():
    """Mark the splash screen as completed for the current user."""
    current_settings = config_manager.get_user_settings()

    expected_keys = [
        "name",
        "specialty",
        "quick_chat_1_title",
        "quick_chat_1_prompt",
        "quick_chat_2_title",
        "quick_chat_2_prompt",
        "quick_chat_3_title",
        "quick_chat_3_prompt",
        "default_letter_template_id",
    ]
    for key in expected_keys:
        if key not in current_settings:
            # Apply same defaults as in get_user_settings's 'else' block or from original structure
            if key == "name" or key == "specialty":
                current_settings[key] = ""
            elif key == "quick_chat_1_title":
                current_settings[key] = "Critique my plan"
            elif key == "quick_chat_1_prompt":
                current_settings[key] = "Critique my plan"
            elif key == "quick_chat_2_title":
                current_settings[key] = "Any additional investigations"
            elif key == "quick_chat_2_prompt":
                current_settings[key] = "Any additional investigations"
            elif key == "quick_chat_3_title":
                current_settings[key] = "Any differentials to consider"
            elif key == "quick_chat_3_prompt":
                current_settings[key] = "Any differentials to consider"
            elif key == "default_letter_template_id":
                current_settings[key] = None

    current_settings["has_completed_splash_screen"] = True
    config_manager.update_user_settings(current_settings)
    return {"message": "Splash screen marked as completed."}
