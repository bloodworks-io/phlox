"""
STT model management utility.

Handles downloading and managing the Omi Med STT v1 (q8_0 GGUF) model,
a Parakeet TDT 0.6B v2 fine-tune for English medical speech-to-text,
from the omi-health/omi-med-stt-v1-gguf repository on HuggingFace.
"""

import hashlib
import logging
import os
import sys
import time
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)


@dataclass
class DownloadProgress:
    """Rich progress information for model downloads."""

    percentage: float  # 0-100
    downloaded_bytes: int
    total_bytes: int
    speed_bytes_per_sec: float
    eta_seconds: float | None
    current_file: str  # always "model"


# Omi Med STT v1 q8_0 GGUF download from HuggingFace.
# Source: https://huggingface.co/omi-health/omi-med-stt-v1-gguf
# Public repo. Derived from nvidia/parakeet-tdt-0.6b-v2 (CC-BY-4.0).
WHISPER_MODELS = {
    "omi-med-stt-v1-q8_0": {
        "url": "https://huggingface.co/omi-health/omi-med-stt-v1-gguf/resolve/main/omi-med-stt-v1-q8_0.gguf",
        "filename": "omi-med-stt-v1-q8_0.gguf",
        "size_mb": 886,
        "sha256": "c4f364a730df7aa9bb0714cda1b1ad5e3104331db9919bb0e2a379d0fb64dbab",
        "description": "Omi Med STT v1 (886MB) - English medical speech-to-text (q8_0)",
        "category": "omi-med-stt",
    },
}

# The single fixed model id used across the app.
DEFAULT_MODEL_ID = "omi-med-stt-v1-q8_0"


def get_data_dir() -> Path:
    """Get platform-specific data directory for storing models."""
    if os.name == "nt":  # Windows
        data_dir = os.environ.get("LOCALAPPDATA", str(Path.home()))
    elif sys.platform == "darwin":  # macOS
        data_dir = str(Path.home() / "Library/Application Support")
    else:  # Linux and others
        data_dir = os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local/share"))
    return Path(data_dir)


class WhisperModelManager:
    """Manages the Omi Med STT model download and listing."""

    def __init__(self):
        # Models stored in data_dir/phlox/whisper_models
        self.models_dir = get_data_dir() / "phlox" / "whisper_models"
        self.models_dir.mkdir(parents=True, exist_ok=True)

    def get_available_models(self) -> list[dict]:
        """Get list of all available STT models."""
        return [
            {
                "id": model_id,
                "name": model_id,
                "size_mb": info["size_mb"],
                "description": info["description"],
                "url": info["url"],
                "category": info["category"],
            }
            for model_id, info in WHISPER_MODELS.items()
        ]

    def get_downloaded_models(self) -> list[dict]:
        """Get list of downloaded models."""
        models = []
        for model_file in self.models_dir.glob("*.gguf"):
            model_id = model_file.stem
            size_mb = round(model_file.stat().st_size / (1024 * 1024), 1)

            info = WHISPER_MODELS.get(model_id)
            if info:
                models.append(
                    {
                        "id": model_id,
                        "name": model_id,
                        "size_mb": size_mb,
                        "description": info["description"],
                        "path": str(model_file),
                        "category": info["category"],
                    }
                )
            else:
                models.append(
                    {
                        "id": model_id,
                        "name": model_id,
                        "size_mb": size_mb,
                        "description": "Custom model",
                        "path": str(model_file),
                        "category": "unknown",
                    }
                )
        return sorted(models, key=lambda m: m["size_mb"])

    def get_model_path(self, model_id: str) -> Path | None:
        """Get the file path for a model."""
        info = WHISPER_MODELS.get(model_id)
        filename = info["filename"] if info else f"{model_id}.gguf"
        model_file = self.models_dir / filename
        if model_file.exists():
            return model_file
        return None

    def _delete_all_models(self) -> None:
        """Delete all existing model files to ensure only one model exists."""
        for model_file in self.models_dir.glob("*.gguf"):
            try:
                model_file.unlink()
                logger.info(f"Deleted existing STT model: {model_file.name}")
            except Exception as e:
                logger.warning(f"Failed to delete {model_file.name}: {e}")

    async def download_model(self, model_id: str, progress_callback=None) -> str:
        """Download the STT model from HuggingFace.

        Note: This will replace any existing model - only one model
        can be active at a time.
        """
        if model_id not in WHISPER_MODELS:
            raise ValueError(f"Unknown model: {model_id}")

        model_info = WHISPER_MODELS[model_id]
        model_file = self.models_dir / model_info["filename"]
        expected_sha256 = model_info["sha256"]

        # Check if the model already exists and is verified
        if model_file.exists() and self._verify_sha256(model_file, expected_sha256):
            logger.info(f"Model {model_id} already exists at {model_file}")
            return str(model_file)

        # Delete any existing models before downloading the new one
        self._delete_all_models()

        url = str(model_info["url"])
        logger.info(f"Downloading {model_id} from {url}")

        # Hugging Face "resolve" URLs commonly 302-redirect to a signed blob URL.
        # httpx does NOT follow redirects by default, so enable it here.
        timeout = httpx.Timeout(600.0)

        # Track download speed and ETA
        start_time = time.time()
        last_update_time = start_time
        last_downloaded = 0

        try:
            async with (
                httpx.AsyncClient(
                    timeout=timeout,
                    follow_redirects=True,
                    headers={"User-Agent": "phlox"},
                ) as client,
                client.stream("GET", url) as response,
            ):
                response.raise_for_status()
                total_size = int(response.headers.get("content-length", 0))

                with model_file.open("wb") as f:
                    downloaded = 0
                    async for chunk in response.aiter_bytes(8192):
                        f.write(chunk)
                        downloaded += len(chunk)

                        # Calculate speed and ETA (update every ~0.5 seconds)
                        current_time = time.time()
                        if (
                            progress_callback
                            and total_size
                            and (current_time - last_update_time) > 0.5
                        ):
                            speed = (downloaded - last_downloaded) / (
                                current_time - last_update_time
                            )
                            eta = (total_size - downloaded) / speed if speed > 0 else None

                            progress = DownloadProgress(
                                percentage=(downloaded / total_size) * 100,
                                downloaded_bytes=downloaded,
                                total_bytes=total_size,
                                speed_bytes_per_sec=speed,
                                eta_seconds=eta,
                                current_file="model",
                            )
                            await progress_callback(progress)

                            last_update_time = current_time
                            last_downloaded = downloaded

            logger.info(f"Successfully downloaded {model_id} to {model_file}")

            # Verify checksum
            if not self._verify_sha256(model_file, expected_sha256):
                with suppress(Exception):
                    model_file.unlink()
                raise ValueError(
                    f"SHA256 checksum verification failed for {model_id}. "
                    "The downloaded file may be corrupted."
                )
            logger.info(f"Checksum verified for {model_id}")

        except Exception:
            # If something fails mid-download, don't leave a corrupt partial file behind.
            if model_file.exists():
                with suppress(Exception):
                    model_file.unlink()
            raise

        return str(model_file)

    def _verify_sha256(self, path: Path, expected: str) -> bool:
        """Verify the SHA256 checksum of a downloaded model file."""
        if not path.exists():
            return False
        h = hashlib.sha256()
        try:
            with path.open("rb") as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    h.update(chunk)
        except Exception as e:
            logger.warning(f"Failed to compute SHA256 for {path}: {e}")
            return False
        actual = h.hexdigest()
        if actual.lower() != expected.lower():
            logger.warning(
                f"SHA256 mismatch for {path.name}: expected {expected}, got {actual}"
            )
            return False
        return True

    def delete_model(self, model_id: str) -> bool:
        """Delete a downloaded model."""
        info = WHISPER_MODELS.get(model_id)
        filename = info["filename"] if info else f"{model_id}.gguf"
        model_file = self.models_dir / filename

        if model_file.exists():
            model_file.unlink()
            logger.info(f"Deleted STT model {model_id}")
            return True

        return False

    def get_default_model_path(self) -> Path:
        """Get the path for the default model."""
        return self.models_dir / WHISPER_MODELS[DEFAULT_MODEL_ID]["filename"]

    def ensure_default_model_exists(self) -> bool:
        """Check if the default model exists and is checksum-valid."""
        path = self.get_default_model_path()
        info = WHISPER_MODELS[DEFAULT_MODEL_ID]
        return path.exists() and self._verify_sha256(path, info["sha256"])


# Singleton instance
whisper_model_manager = WhisperModelManager()
