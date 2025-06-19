import os
import sys
from pathlib import Path
from platformdirs import user_data_dir

# Constants
IS_TESTING = os.getenv("TESTING", "false").lower() == "true"
IS_DOCKER = os.getenv("DOCKER_CONTAINER") == "true"
APP_NAME = "Phlox"
APP_AUTHOR = "bloodworks.io"

# Models that support/require thinking steps
THINKING_MODELS = [
    "qwen3",
    "deespeek-r"
]

def is_thinking_model(model_name: str) -> bool:
    """Check if a model requires thinking steps."""
    if not model_name:
        return False
    model_lower = model_name.lower()
    return any(thinking_model in model_lower for thinking_model in THINKING_MODELS)

def add_thinking_to_schema(base_schema: dict, model_name: str) -> dict:
    """Add thinking field to schema if model supports thinking."""
    if not is_thinking_model(model_name):
        return base_schema

    # Create a copy of the schema
    thinking_schema = base_schema.copy()

    # Create new properties dict with thinking first
    new_properties = {
        "thinking": {
            "type": "string",
            "description": "Internal reasoning and thought process before providing the final response"
        }
    }

    # Add existing properties after thinking
    if "properties" in thinking_schema:
        new_properties.update(thinking_schema["properties"])

    thinking_schema["properties"] = new_properties

    # Update required fields - thinking should be first in required too
    if "required" in thinking_schema:
        thinking_schema["required"] = ["thinking"] + thinking_schema["required"]
    else:
        thinking_schema["required"] = ["thinking"]

    return thinking_schema

def get_app_directories():
    """Get appropriate directories based on environment"""
    if IS_DOCKER:
        data_dir = Path("/usr/src/app/data")
        build_dir = Path("/usr/src/app/build")
    else:
        # For Tauri desktop app
        data_dir = Path(user_data_dir(APP_NAME, APP_AUTHOR))
        build_dir = None  # No need to serve static files

    return data_dir, build_dir

# Get directories
DATA_DIR, BUILD_DIR = get_app_directories()

# Create directories if they don't exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
