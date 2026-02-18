"""
Whisper model management utility.

Handles downloading, listing, and managing Whisper GGML models
from the ggerganov/whisper.cpp repository on HuggingFace.
"""

import logging
import os
import shutil
import sys
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class DownloadProgress:
    """Rich progress information for model downloads."""

    percentage: float  # 0-100
    downloaded_bytes: int
    total_bytes: int
    speed_bytes_per_sec: float
    eta_seconds: Optional[float]
    current_file: str  # "model" or "coreml"


# Official whisper.cpp model downloads from HuggingFace
# Source: https://huggingface.co/ggerganov/whisper.cpp
WHISPER_MODELS = {
    "tiny": {
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        "coreml_url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-encoder.mlmodelc.zip",
        "size_mb": 39,
        "description": "Tiny (39MB) - Multilingual, fastest",
        "category": "tiny",
    },
    "tiny.en": {
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
        "coreml_url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-encoder.mlmodelc.zip",
        "size_mb": 39,
        "description": "Tiny English-only (39MB) - Fastest",
        "category": "tiny",
    },
    "base": {
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        "coreml_url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-encoder.mlmodelc.zip",
        "size_mb": 74,
        "description": "Base (74MB) - Multilingual",
        "category": "base",
    },
    "base.en": {
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
        "coreml_url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-encoder.mlmodelc.zip",
        "size_mb": 74,
        "description": "Base English-only (74MB) - Recommended for most",
        "category": "base",
    },
    "small": {
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        "coreml_url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-encoder.mlmodelc.zip",
        "size_mb": 244,
        "description": "Small (244MB) - Multilingual, better accuracy",
        "category": "small",
    },
    "small.en": {
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
        "coreml_url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-encoder.mlmodelc.zip",
        "size_mb": 244,
        "description": "Small English-only (244MB) - Better accuracy",
        "category": "small",
    },
    "medium": {
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        "coreml_url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-encoder.mlmodelc.zip",
        "size_mb": 769,
        "description": "Medium (769MB) - Multilingual, high accuracy",
        "category": "medium",
    },
    "medium.en": {
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin",
        "coreml_url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-encoder.mlmodelc.zip",
        "size_mb": 769,
        "description": "Medium English-only (769MB) - High accuracy",
        "category": "medium",
    },
    "large-v1": {
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v1.bin",
        "coreml_url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v1-encoder.mlmodelc.zip",
        "size_mb": 1530,
        "description": "Large V1 (1.5GB) - Multilingual, best accuracy",
        "category": "large",
    },
    "large-v2": {
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2.bin",
        "coreml_url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2-encoder.mlmodelc.zip",
        "size_mb": 1530,
        "description": "Large V2 (1.5GB) - Multilingual, improved accuracy",
        "category": "large",
    },
    "large-v3": {
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
        "coreml_url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-encoder.mlmodelc.zip",
        "size_mb": 1530,
        "description": "Large V3 (1.5GB) - Multilingual, latest",
        "category": "large",
    },
}


def get_data_dir() -> Path:
    """Get platform-specific data directory for storing models."""
    if os.name == "nt":  # Windows
        data_dir = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
    elif sys.platform == "darwin":  # macOS
        data_dir = os.path.expanduser("~/Library/Application Support")
    else:  # Linux and others
        data_dir = os.environ.get(
            "XDG_DATA_HOME", os.path.expanduser("~/.local/share")
        )
    return Path(data_dir)


class WhisperModelManager:
    """Manages Whisper model downloads and listing."""

    def __init__(self):
        # Models stored in data_dir/phlox/whisper_models
        self.models_dir = get_data_dir() / "phlox" / "whisper_models"
        self.models_dir.mkdir(parents=True, exist_ok=True)

    def get_available_models(self) -> List[Dict]:
        """Get list of all available whisper.cpp models."""
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

    def get_downloaded_models(self) -> List[Dict]:
        """Get list of downloaded models."""
        models = []
        for model_file in self.models_dir.glob("ggml-*.bin"):
            model_id = model_file.stem.replace("ggml-", "")
            size_mb = round(model_file.stat().st_size / (1024 * 1024), 1)

            # Check if Core ML model also exists
            has_coreml = self._has_coreml_model(model_id)

            # Check if this is a known model
            if model_id in WHISPER_MODELS:
                models.append(
                    {
                        "id": model_id,
                        "name": model_id,
                        "size_mb": size_mb,
                        "description": WHISPER_MODELS[model_id]["description"],
                        "path": str(model_file),
                        "category": WHISPER_MODELS[model_id]["category"],
                        "has_coreml": has_coreml,
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
                        "has_coreml": has_coreml,
                    }
                )
        return sorted(models, key=lambda m: m["size_mb"])

    def get_model_path(self, model_id: str) -> Optional[Path]:
        """Get the file path for a model."""
        model_file = self.models_dir / f"ggml-{model_id}.bin"
        if model_file.exists():
            return model_file
        return None

    def is_model_downloaded(self, model_id: str) -> bool:
        """Check if a model is downloaded."""
        return self.get_model_path(model_id) is not None

    def _get_coreml_model_path(self, model_id: str) -> Optional[Path]:
        """Get the directory path for a Core ML model."""
        coreml_dir = self.models_dir / f"ggml-{model_id}-encoder.mlmodelc"
        if coreml_dir.exists():
            return coreml_dir
        return None

    def _has_coreml_model(self, model_id: str) -> bool:
        """Check if Core ML model exists for this model."""
        return self._get_coreml_model_path(model_id) is not None

    def _delete_all_models(self) -> None:
        """Delete all existing model files to ensure only one model exists."""
        for model_file in self.models_dir.glob("ggml-*.bin"):
            try:
                model_file.unlink()
                logger.info(
                    f"Deleted existing Whisper model: {model_file.name}"
                )
            except Exception as e:
                logger.warning(f"Failed to delete {model_file.name}: {e}")

    def _delete_all_coreml_models(self) -> None:
        """Delete all existing Core ML model directories."""
        for coreml_dir in self.models_dir.glob("ggml-*-encoder.mlmodelc"):
            try:
                shutil.rmtree(coreml_dir)
                logger.info(
                    f"Deleted existing Core ML model: {coreml_dir.name}"
                )
            except Exception as e:
                logger.warning(f"Failed to delete {coreml_dir.name}: {e}")

    async def download_model(
        self, model_id: str, progress_callback=None
    ) -> str:
        """Download a whisper model from HuggingFace.

        Note: This will replace any existing Whisper model - only one model
        can be active at a time.
        """
        if model_id not in WHISPER_MODELS:
            raise ValueError(f"Unknown model: {model_id}")

        model_info = WHISPER_MODELS[model_id]
        model_file = self.models_dir / f"ggml-{model_id}.bin"
        coreml_dir = self.models_dir / f"ggml-{model_id}-encoder.mlmodelc"

        # Check if both model files already exist
        if model_file.exists() and coreml_dir.exists():
            logger.info(f"Model {model_id} already exists at {model_file}")
            return str(model_file)

        # Delete any existing models before downloading the new one
        self._delete_all_models()
        self._delete_all_coreml_models()

        url = model_info["url"]
        logger.info(f"Downloading {model_id} from {url}")

        # Hugging Face "resolve" URLs commonly 302-redirect to a signed blob URL.
        # httpx does NOT follow redirects by default, so enable it here.
        timeout = httpx.Timeout(600.0)

        # Track download speed and ETA
        start_time = time.time()
        last_update_time = start_time
        last_downloaded = 0

        try:
            # Download the main .bin model file
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
                headers={"User-Agent": "phlox"},
            ) as client:
                async with client.stream("GET", url) as response:
                    response.raise_for_status()
                    total_size = int(response.headers.get("content-length", 0))

                    with open(model_file, "wb") as f:
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
                                eta = (
                                    (total_size - downloaded) / speed
                                    if speed > 0
                                    else None
                                )

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

            # Download Core ML model if available
            coreml_url = model_info.get("coreml_url")
            if coreml_url:
                logger.info(
                    f"Downloading Core ML model for {model_id} from {coreml_url}"
                )
                zip_file = (
                    self.models_dir / f"ggml-{model_id}-encoder.mlmodelc.zip"
                )

                try:
                    # Reset tracking for CoreML download
                    coreml_start_time = time.time()
                    coreml_last_update = coreml_start_time
                    coreml_last_downloaded = 0

                    async with httpx.AsyncClient(
                        timeout=timeout,
                        follow_redirects=True,
                        headers={"User-Agent": "phlox"},
                    ) as client:
                        async with client.stream("GET", coreml_url) as response:
                            response.raise_for_status()
                            total_size = int(
                                response.headers.get("content-length", 0)
                            )

                            with open(zip_file, "wb") as f:
                                downloaded = 0
                                async for chunk in response.aiter_bytes(8192):
                                    f.write(chunk)
                                    downloaded += len(chunk)

                                    # Calculate speed and ETA for CoreML
                                    current_time = time.time()
                                    if (
                                        progress_callback
                                        and total_size
                                        and (current_time - coreml_last_update)
                                        > 0.5
                                    ):
                                        speed = (
                                            downloaded - coreml_last_downloaded
                                        ) / (current_time - coreml_last_update)
                                        eta = (
                                            (total_size - downloaded) / speed
                                            if speed > 0
                                            else None
                                        )

                                        progress = DownloadProgress(
                                            percentage=(downloaded / total_size)
                                            * 100,
                                            downloaded_bytes=downloaded,
                                            total_bytes=total_size,
                                            speed_bytes_per_sec=speed,
                                            eta_seconds=eta,
                                            current_file="coreml",
                                        )
                                        await progress_callback(progress)

                                        coreml_last_update = current_time
                                        coreml_last_downloaded = downloaded

                    # Extract the zip file
                    logger.info(f"Extracting Core ML model to {coreml_dir}")
                    with zipfile.ZipFile(zip_file, "r") as zip_ref:
                        zip_ref.extractall(self.models_dir)

                    # Remove the zip file after extraction
                    zip_file.unlink()
                    logger.info(
                        f"Successfully downloaded and extracted Core ML model for {model_id}"
                    )

                except Exception as e:
                    # Clean up partial downloads on failure
                    if zip_file.exists():
                        try:
                            zip_file.unlink()
                        except Exception:
                            pass
                    # If Core ML download fails, log a warning but don't fail the entire download
                    # The model will still work with Metal GPU acceleration
                    logger.warning(
                        f"Failed to download Core ML model for {model_id}: {e}"
                    )
                    logger.info(
                        f"Model {model_id} will use Metal GPU acceleration instead"
                    )

        except Exception:
            # If something fails mid-download, don't leave a corrupt partial file behind.
            if model_file.exists():
                try:
                    model_file.unlink()
                except Exception:
                    pass
            if coreml_dir.exists():
                try:
                    shutil.rmtree(coreml_dir)
                except Exception:
                    pass
            raise

        # Write the model selection file for Tauri to read
        self._write_model_selection_file(model_id)

        return str(model_file)

    def delete_model(self, model_id: str) -> bool:
        """Delete a downloaded model."""
        model_file = self.models_dir / f"ggml-{model_id}.bin"
        coreml_dir = self.models_dir / f"ggml-{model_id}-encoder.mlmodelc"

        deleted = False

        if model_file.exists():
            model_file.unlink()
            logger.info(f"Deleted Whisper model {model_id}")
            deleted = True

        if coreml_dir.exists():
            shutil.rmtree(coreml_dir)
            logger.info(f"Deleted Core ML model for {model_id}")
            deleted = True

        if deleted:
            # Also clean up the model selection file if it exists
            self._delete_model_selection_file()

        return deleted

    def _get_model_selection_file_path(self) -> Path:
        """Get the path to the model selection file."""
        return get_data_dir() / "phlox" / "whisper_model.txt"

    def _write_model_selection_file(self, model_id: str) -> None:
        """Write the selected model ID to a file for Tauri to read."""
        selection_file = self._get_model_selection_file_path()
        try:
            selection_file.parent.mkdir(parents=True, exist_ok=True)
            selection_file.write_text(model_id)
            logger.info(
                f"Wrote model selection to {selection_file}: {model_id}"
            )
        except Exception as e:
            logger.warning(f"Failed to write model selection file: {e}")

    def _delete_model_selection_file(self) -> None:
        """Delete the model selection file."""
        selection_file = self._get_model_selection_file_path()
        if selection_file.exists():
            try:
                selection_file.unlink()
                logger.info(f"Deleted model selection file")
            except Exception as e:
                logger.warning(f"Failed to delete model selection file: {e}")

    def get_default_model_path(self) -> Path:
        """Get the path for the default model (base.en)."""
        return self.models_dir / "ggml-base.en.bin"

    def ensure_default_model_exists(self) -> bool:
        """Check if the default model exists."""
        return self.get_default_model_path().exists()


# Singleton instance
whisper_model_manager = WhisperModelManager()
