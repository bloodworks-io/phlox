import os
import sys
from pathlib import Path
from platformdirs import user_data_dir

# Constants
IS_TESTING = os.getenv("TESTING", "false").lower() == "true"
IS_DOCKER = (
    os.path.exists("/.dockerenv") or os.getenv("DOCKER_CONTAINER") == "true"
)
APP_NAME = "Phlox"
APP_AUTHOR = "bloodworks.io"


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
