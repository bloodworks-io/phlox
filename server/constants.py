import logging
import os
import tempfile
from pathlib import Path

from platformdirs import user_data_dir

# Constants
IS_TESTING = os.getenv("TESTING", "false").lower() == "true"
IS_DOCKER = Path("/.dockerenv").exists() or os.getenv("DOCKER_CONTAINER") == "true"
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "false").lower() == "true"

IS_DEMO_MODE = os.getenv("PHLOX_DEMO_MODE", "false").lower() == "true"

RATE_LIMIT_DESKTOP_MULTIPLIER = int(os.getenv("RATE_LIMIT_DESKTOP_MULTIPLIER", "3"))

# Proxy auth configuration (for reverse proxy deployments)
PROXY_AUTH_ENABLED = os.getenv("PROXY_AUTH_ENABLED", "false").lower() == "true"
PROXY_AUTH_USER_HEADER = os.getenv("PROXY_AUTH_USER_HEADER", "X-Forwarded-User")
PROXY_AUTH_ALLOWED_USERS = [
    u.strip() for u in os.getenv("PROXY_AUTH_ALLOWED_USERS", "").split(",") if u.strip()
]

TRUSTED_PROXY_IPS = [
    ip.strip() for ip in os.getenv("TRUSTED_PROXY_IPS", "").split(",") if ip.strip()
]

PHLOX_PASSPHRASE = os.getenv("PHLOX_PASSPHRASE", "").strip()
PHLOX_ALLOW_UNAUTHENTICATED = os.getenv("PHLOX_ALLOW_UNAUTHENTICATED", "false").lower() == "true"

MAX_BODY_BYTES = 100 * 1024 * 1024
MAX_AUDIO_BODY_BYTES = 1024 * 1024 * 1024

APP_NAME = "Phlox"
APP_AUTHOR = "bloodworks.io"

PROTECTED_TEMPLATE_PREFIXES = ("phlox_", "soap_", "progress_")


def is_protected_template_key(template_key: str) -> bool:
    return template_key.startswith(PROTECTED_TEMPLATE_PREFIXES)


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
        logger.info(f"IS_DOCKER={IS_DOCKER}")
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
