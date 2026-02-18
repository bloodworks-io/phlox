import logging
import os
import sys
import tempfile
from pathlib import Path

from platformdirs import user_data_dir

# Constants
IS_TESTING = os.getenv("TESTING", "false").lower() == "true"
IS_DOCKER = (
    os.path.exists("/.dockerenv") or os.getenv("DOCKER_CONTAINER") == "true"
)
APP_NAME = "Phlox"
APP_AUTHOR = "bloodworks.io"


logger = logging.getLogger(__name__)


def get_app_directories():
    """Get appropriate directories based on environment"""
    if IS_DOCKER:
        logger.info("Running in Docker environment; setting up directories")
        data_dir = Path("/usr/src/app/data")
        build_dir = Path("/usr/src/app/build")
    else:
        # For Tauri desktop app
        logger.info("Running in desktop environment; setting up directories")
        data_dir = Path(user_data_dir(APP_NAME, APP_AUTHOR))
        logger.info("Data directory: %s", data_dir)
        build_dir = None  # No need to serve static files

    return data_dir, build_dir


# Get directories
DATA_DIR, BUILD_DIR = get_app_directories()

# Create directories if they don't exist
DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_temp_directory():
    """Get appropriate temporary directory based on environment"""
    if IS_DOCKER:
        temp_dir = Path("/usr/src/app/temp")
    else:
        # Use system temp directory with app-specific subdirectory
        temp_dir = Path(tempfile.gettempdir()) / "phlox"
    temp_dir.mkdir(parents=True, exist_ok=True)
    return temp_dir


TEMP_DIR = get_temp_directory()


def get_changelog_path() -> Path:
    """Get the path to CHANGELOG.md based on environment."""
    if IS_DOCKER:
        return Path("/usr/src/app/CHANGELOG.md")
    else:
        # For desktop, look for CHANGELOG.md in several locations:
        # When bundled with Nuitka/Tauri, it's in server_dist/ alongside the server binary
        # When running from source, it's in the project root

        # Get the directory where this file is located
        # In bundled app: server_dist/server/constants.py -> server_dist/server/
        # In source: phlox/server/constants.py -> phlox/server/
        this_dir = Path(__file__).parent

        # Check if CHANGELOG.md is in parent directory (bundled in server_dist/)
        bundled = this_dir.parent / "CHANGELOG.md"
        if bundled.exists():
            return bundled

        # Check project root (running from source: server/../CHANGELOG.md)
        source_root = this_dir.parent / "CHANGELOG.md"
        if source_root.exists():
            return source_root

        # Fallback: current working directory
        cwd_changelog = Path.cwd() / "CHANGELOG.md"
        if cwd_changelog.exists():
            return cwd_changelog

        # Last resort: check src-tauri/server_dist (dev mode after build)
        dev_bundled = (
            this_dir.parent.parent
            / "src-tauri"
            / "server_dist"
            / "CHANGELOG.md"
        )
        if dev_bundled.exists():
            return dev_bundled

        return source_root  # Return default even if doesn't exist


CHANGELOG_PATH = get_changelog_path()
