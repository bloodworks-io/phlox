"""
STT model management utility.

Handles downloading and managing the Omi Med STT v1 (q8_0 GGUF) model,
a Parakeet TDT 0.6B v2 fine-tune for English medical speech-to-text,
from the omi-health/omi-med-stt-v1-gguf repository on HuggingFace.
"""

import logging
import time
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import TypedDict

import httpx

from server.constants import DATA_DIR

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


class ModelInfo(TypedDict):
    """Metadata for a single STT model."""

    url: str
    filename: str
    size_mb: int
    description: str
    category: str


# Omi Med STT v1 q8_0 GGUF download from HuggingFace.
# Source: https://huggingface.co/omi-health/omi-med-stt-v1-gguf
# Public repo. Derived from nvidia/parakeet-tdt-0.6b-v2 (CC-BY-4.0).
WHISPER_MODELS: dict[str, ModelInfo] = {
    "omi-med-stt-v1-q8_0": {
        "url": "https://huggingface.co/omi-health/omi-med-stt-v1-gguf/resolve/main/omi-med-stt-v1-q8_0.gguf",
        "filename": "omi-med-stt-v1-q8_0.gguf",
        "size_mb": 886,
        "description": "Omi Med STT v1 (886MB) - English medical speech-to-text (q8_0)",
        "category": "omi-med-stt",
    },
}

# The single fixed model id used across the app.
DEFAULT_MODEL_ID = "omi-med-stt-v1-q8_0"


class WhisperModelManager:
    """Manages the Omi Med STT model download and listing."""

    def __init__(self):
        self.models_dir = DATA_DIR / "whisper_models"
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
        """Get the file path for a known (catalog) model, or None."""
        info = WHISPER_MODELS.get(model_id)
        if not info:
            return None
        model_file = self.models_dir / info["filename"]
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

        # Check if the model already exists
        if model_file.exists():
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

        except Exception:
            # If something fails mid-download, don't leave a corrupt partial file behind.
            if model_file.exists():
                with suppress(Exception):
                    model_file.unlink()
            raise

        return str(model_file)

    def delete_model(self, model_id: str) -> bool:
        """Delete a downloaded catalog model.

        Only pre-configured model ids are accepted; the filename is taken from
        the catalog so user input never reaches the filesystem path.
        """
        info = WHISPER_MODELS.get(model_id)
        if not info:
            return False
        model_file = self.models_dir / info["filename"]

        if model_file.exists():
            model_file.unlink()
            logger.info(f"Deleted STT model {model_id}")
            return True

        return False

    def get_default_model_path(self) -> Path:
        """Get the path for the default model."""
        return self.models_dir / WHISPER_MODELS[DEFAULT_MODEL_ID]["filename"]

    def ensure_default_model_exists(self) -> bool:
        """Check if the default model exists."""
        return self.get_default_model_path().exists()


# Singleton instance
whisper_model_manager = WhisperModelManager()
