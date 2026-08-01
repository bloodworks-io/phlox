"""
STT model management utility.

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
    languages: list[str]


PARAKEET_TDT_V3_LANGUAGES = [
    "bg", "hr", "cs", "da", "nl", "en", "et", "fi", "fr", "de",
    "el", "hu", "it", "lv", "lt", "mt", "pl", "pt", "ro", "sk",
    "sl", "es", "sv", "ru", "uk",
]
# fmt: on


WHISPER_MODELS: dict[str, ModelInfo] = {
    "omi-med-stt-v1-q8_0": {
        "url": "https://huggingface.co/omi-health/omi-med-stt-v1-gguf/resolve/main/omi-med-stt-v1-q8_0.gguf",
        "filename": "omi-med-stt-v1-q8_0.gguf",
        "size_mb": 886,
        "description": "Omi Med STT v1 (886MB) - English medical speech-to-text (q8_0)",
        "category": "omi-med-stt",
        "languages": ["en"],
    },

    "tdt-0.6b-v3-q8_0": {
        "url": "https://huggingface.co/mudler/parakeet-cpp-gguf/resolve/main/tdt-0.6b-v3-q8_0.gguf",
        "filename": "tdt-0.6b-v3-q8_0.gguf",
        "size_mb": 941,
        "description": "Parakeet TDT 0.6B v3 (941MB) - Multilingual (25 EU languages) speech-to-text (q8_0)",
        "category": "parakeet-tdt-multilingual",
        "languages": PARAKEET_TDT_V3_LANGUAGES,
    },
}


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
                "languages": info["languages"],
            }
            for model_id, info in WHISPER_MODELS.items()
        ]

    def get_downloaded_models(self) -> list[dict]:
        """Get list of downloaded models."""
        # Resolve the active selection so each model can report is_selected.
        selection_file = self._get_model_selection_file_path()
        selected_filename = None
        if selection_file.exists():
            selected_filename = selection_file.read_text().strip()

        models = []
        for model_file in self.models_dir.glob("*.gguf"):
            model_id = model_file.stem
            size_mb = round(model_file.stat().st_size / (1024 * 1024), 1)

            info = WHISPER_MODELS.get(model_id)
            if info:
                canonical = str(info["filename"])
                models.append(
                    {
                        "id": model_id,
                        "name": model_id,
                        "size_mb": size_mb,
                        "description": info["description"],
                        "path": str(model_file),
                        "category": info["category"],
                        "languages": info["languages"],
                        "is_selected": selected_filename in (model_file.name, canonical),
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
                        "languages": [],
                        "is_selected": selected_filename == model_file.name,
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
            self._write_model_selection_file(model_info["filename"])
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

        # Record the active selection for the Rust process manager to read.
        self._write_model_selection_file(model_info["filename"])
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
            self._delete_model_selection_file()
            return True

        return False

    def _get_model_selection_file_path(self) -> Path:
        """Path to the active-model selection file read by the Rust process manager."""
        return DATA_DIR / "whisper_model.txt"

    def _write_model_selection_file(self, filename: str) -> None:
        """Write the selected model filename so Tauri loads it on next whisper start."""
        selection_file = self._get_model_selection_file_path()
        try:
            selection_file.parent.mkdir(parents=True, exist_ok=True)
            selection_file.write_text(filename)
            logger.info(f"Wrote STT model selection to {selection_file}: {filename}")
        except Exception as e:
            logger.warning(f"Failed to write STT model selection file: {e}")

    def _delete_model_selection_file(self) -> None:
        """Delete the model selection file."""
        selection_file = self._get_model_selection_file_path()
        if selection_file.exists():
            try:
                selection_file.unlink()
                logger.info("Deleted STT model selection file")
            except Exception as e:
                logger.warning(f"Failed to delete STT model selection file: {e}")

    def get_selected_model_id(self) -> str | None:
        """Get the model_id of the currently selected STT model.

        Reads whisper_model.txt and maps the filename back to a catalog model_id.
        Returns None if no selection file exists or the filename is unknown.
        """
        selection_file = self._get_model_selection_file_path()
        if not selection_file.exists():
            return None

        selected_filename = selection_file.read_text().strip()
        for model_id, info in WHISPER_MODELS.items():
            if str(info["filename"]).lower() == selected_filename.lower():
                return model_id
        return None

    def get_active_model_languages(self) -> list[str]:
        """Languages supported by the active (selected, or default) local STT model."""
        model_id = self.get_selected_model_id() or DEFAULT_MODEL_ID
        info = WHISPER_MODELS.get(model_id)
        return list(info["languages"]) if info else ["en"]

    def get_default_model_path(self) -> Path:
        """Get the path for the default model."""
        return self.models_dir / WHISPER_MODELS[DEFAULT_MODEL_ID]["filename"]

    def ensure_default_model_exists(self) -> bool:
        """Check if the default model exists."""
        return self.get_default_model_path().exists()


# Singleton instance
whisper_model_manager = WhisperModelManager()
