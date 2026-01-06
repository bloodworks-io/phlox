"""
LLM model management utility.

Handles downloading, listing, and managing LLM GGUF models
from HuggingFace. Follows the Whisper pattern: 1 model at a time.
"""

import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

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
    eta_seconds: Optional[float]
    current_file: str  # "model" or "coreml"


# Pre-configured Unsloth Qwen3 models from HuggingFace
# Source: https://huggingface.co/unsloth
# Note: Filenames must match exactly what's on HuggingFace
PRECONFIGURED_MODELS = {
    "qwen3-0.6b": {
        "repo_id": "unsloth/Qwen3-0.6B-GGUF",
        "filename": "Qwen3-0.6B-Q4_K_M.gguf",
        "size_mb": 523,
        "description": "Fast but limited quality",
        "category": "tiny",
        "min_ram_gb": 1,
        "recommended_ram_gb": 2,
        "simple_name": "Tiny",
        "tier": [],
        "parameters_billions": 0.6,
    },
    "qwen3-1.7b": {
        "repo_id": "unsloth/Qwen3-1.7B-GGUF",
        "filename": "Qwen3-1.7B-Q4_K_M.gguf",
        "size_mb": 1400,
        "description": "Fast and capable for everyday tasks",
        "category": "small",
        "min_ram_gb": 2,
        "recommended_ram_gb": 4,
        "simple_name": "Small",
        "tier": [1],
        "parameters_billions": 1.7,
    },
    "qwen3-4b": {
        "repo_id": "unsloth/Qwen3-4B-Instruct-2507-GGUF",
        "filename": "Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
        "size_mb": 2600,
        "description": "A great balance of speed and quality",
        "category": "medium",
        "min_ram_gb": 4,
        "recommended_ram_gb": 8,
        "simple_name": "Balanced",
        "tier": [1, 2],
        "parameters_billions": 4.0,
    },
    "qwen3-8b": {
        "repo_id": "unsloth/Qwen3-8B-GGUF",
        "filename": "Qwen3-8B-Q4_K_M.gguf",
        "size_mb": 5200,
        "description": "High quality, good for most users",
        "category": "medium",
        "min_ram_gb": 6,
        "recommended_ram_gb": 12,
        "simple_name": "Large",
        "tier": [1, 2, 3],
        "parameters_billions": 8.0,
    },
    "qwen3-14b": {
        "repo_id": "unsloth/Qwen3-14B-GGUF",
        "filename": "Qwen3-14B-Q4_K_M.gguf",
        "size_mb": 9300,
        "description": "Excellent quality, slower responses",
        "category": "large",
        "min_ram_gb": 12,
        "recommended_ram_gb": 16,
        "simple_name": "Extra Large",
        "tier": [2, 3],
        "parameters_billions": 14.0,
    },
    "qwen3-30b": {
        "repo_id": "unsloth/Qwen3-30B-A3B-Instruct-2507-GGUF",
        "filename": "Qwen3-30B-A3B-Instruct-2507-Q4_K_M.gguf",
        "size_mb": 19000,
        "description": "Fast and excellent quality (special architecture)",
        "category": "large",
        "min_ram_gb": 24,
        "recommended_ram_gb": 32,
        "simple_name": "Premium",
        "tier": [3],
        "parameters_billions": 30.0,
        "active_parameters_billions": 3.0,  # A3B architecture - only 3B active
    },
    "qwen3-32b": {
        "repo_id": "unsloth/Qwen3-32B-GGUF",
        "filename": "Qwen3-32B-Q4_K_M.gguf",
        "size_mb": 20000,
        "description": "Top-tier quality, requires high-end hardware",
        "category": "large",
        "min_ram_gb": 24,
        "recommended_ram_gb": 32,
        "simple_name": "Ultra",
        "tier": [],
        "parameters_billions": 32.0,
    },
}


class LlamaModelManager:
    """Manages LLM GGUF model downloads and listing.

    Follows the Whisper pattern: only one model at a time.
    """

    def __init__(self):
        # Models stored in DATA_DIR/llm_models
        self.models_dir = DATA_DIR / "llm_models"
        self.models_dir.mkdir(parents=True, exist_ok=True)

    def get_available_models(self) -> List[Dict]:
        """Get list of pre-configured models."""
        return [
            {
                "id": model_id,
                "name": model_id,
                "size_mb": info["size_mb"],
                "description": info["description"],
                "category": info["category"],
                "min_ram_gb": info.get("min_ram_gb", 2),
                "recommended_ram_gb": info.get("recommended_ram_gb", 4),
                "repo_id": info["repo_id"],
                "filename": info["filename"],
                "simple_name": info.get("simple_name", model_id),
                "tier": info.get("tier", []),
                "parameters_billions": info.get("parameters_billions"),
                "active_parameters_billions": info.get(
                    "active_parameters_billions"
                ),
            }
            for model_id, info in PRECONFIGURED_MODELS.items()
        ]

    def get_downloaded_models(self) -> List[Dict]:
        """Get list of downloaded models (should be max 1)."""
        models = []

        # First, check if we have a model selection file
        selection_file = self._get_model_selection_file_path()
        selected_filename = None
        if selection_file.exists():
            selected_filename = selection_file.read_text().strip()

        for model_file in self.models_dir.glob("*.gguf"):
            size_mb = round(model_file.stat().st_size / (1024 * 1024), 1)
            filename = model_file.name

            # Check if this is a pre-configured model (case-insensitive match)
            model_info = None
            matched_filename = None
            for model_id, info in PRECONFIGURED_MODELS.items():
                if info["filename"].lower() == filename.lower():
                    model_info = info
                    matched_filename = info[
                        "filename"
                    ]  # Use the canonical filename
                    break

            if model_info:
                # Find the model_id by matching filename
                model_id = next(
                    k
                    for k, v in PRECONFIGURED_MODELS.items()
                    if v["filename"].lower() == filename.lower()
                )
                models.append(
                    {
                        "id": model_id,
                        "name": model_id,  # Use model_id as name for display
                        "filename": matched_filename,  # Canonical filename for matching
                        "size_mb": size_mb,
                        "description": model_info["description"],
                        "path": str(model_file),
                        "category": model_info["category"],
                        "is_selected": selected_filename == filename
                        or selected_filename == matched_filename,
                    }
                )
            else:
                # Custom model
                models.append(
                    {
                        "id": filename,
                        "name": filename,
                        "filename": filename,
                        "size_mb": size_mb,
                        "description": "Custom model",
                        "path": str(model_file),
                        "category": "custom",
                        "is_selected": selected_filename == filename,
                    }
                )

        return sorted(models, key=lambda m: m["size_mb"])

    def get_model_path(self, filename: str) -> Optional[Path]:
        """Get the file path for a model."""
        model_file = self.models_dir / filename
        if model_file.exists():
            return model_file
        return None

    def is_model_downloaded(self, filename: str) -> bool:
        """Check if a model is downloaded."""
        return self.get_model_path(filename) is not None

    def _delete_all_models(self) -> None:
        """Delete all existing model files to ensure only one model exists."""
        for model_file in self.models_dir.glob("*.gguf"):
            try:
                model_file.unlink()
                logger.info(f"Deleted existing LLM model: {model_file.name}")
            except Exception as e:
                logger.warning(f"Failed to delete {model_file.name}: {e}")

    async def download_model(
        self, model_id: str, progress_callback=None
    ) -> str:
        """Download a model. Deletes existing model first.

        Args:
            model_id: Either a pre-configured model ID (e.g., "qwen3-4b")
                     or a custom "repo_id/filename.gguf" string
            progress_callback: Optional async callback for progress updates

        Returns:
            Path to the downloaded model file
        """
        repo_id = None
        filename = None

        # Check if it's a pre-configured model
        if model_id in PRECONFIGURED_MODELS:
            model_info = PRECONFIGURED_MODELS[model_id]
            repo_id = model_info["repo_id"]
            filename = model_info["filename"]
        elif "/" in model_id:
            # Custom format: "repo_id/filename.gguf"
            parts = model_id.split("/", 1)
            if len(parts) == 2:
                repo_id = parts[0]
                filename = parts[1]
            else:
                raise ValueError(
                    f"Invalid custom model format. Use 'repo_id/filename.gguf'"
                )
        else:
            raise ValueError(f"Unknown model: {model_id}")

        # Delete existing models first (1 model at a time)
        self._delete_all_models()

        model_file = self.models_dir / filename
        url = f"https://huggingface.co/{repo_id}/resolve/main/{filename}"

        logger.info(f"Downloading {filename} from {repo_id}")

        timeout = httpx.Timeout(600.0)

        # Track download speed and ETA
        start_time = time.time()
        last_update_time = start_time
        last_downloaded = 0

        try:
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

            # Send final 100% progress
            if progress_callback and total_size:
                progress = DownloadProgress(
                    percentage=100.0,
                    downloaded_bytes=total_size,
                    total_bytes=total_size,
                    speed_bytes_per_sec=0,
                    eta_seconds=0,
                    current_file="model",
                )
                await progress_callback(progress)

            logger.info(f"Successfully downloaded {filename} to {model_file}")

        except Exception:
            # Clean up partial downloads on failure
            if model_file.exists():
                try:
                    model_file.unlink()
                except Exception:
                    pass
            raise

        # Write the model selection file for Tauri to read
        self._write_model_selection_file(filename)

        return str(model_file)

    def delete_model(self, filename: str) -> bool:
        """Delete a downloaded model."""
        model_file = self.models_dir / filename

        if model_file.exists():
            model_file.unlink()
            logger.info(f"Deleted LLM model {filename}")
            # Also clean up the model selection file
            self._delete_model_selection_file()
            return True

        return False

    def _get_model_selection_file_path(self) -> Path:
        """Get the path to the model selection file."""
        return DATA_DIR / "llm_model.txt"

    def _write_model_selection_file(self, filename: str) -> None:
        """Write the selected model filename to a file for Tauri to read."""
        selection_file = self._get_model_selection_file_path()
        try:
            selection_file.parent.mkdir(parents=True, exist_ok=True)
            selection_file.write_text(filename)
            logger.info(
                f"Wrote model selection to {selection_file}: {filename}"
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

    def get_default_model_filename(self) -> str:
        """Get the filename for the default model (qwen3-4b)."""
        return PRECONFIGURED_MODELS["qwen3-4b"]["filename"]

    def get_selected_model_id(self) -> Optional[str]:
        """Get the model_id of the currently selected model.

        Reads the llm_model.txt file and maps the filename back to model_id
        for pre-configured models. Returns None if no model is selected.
        """
        selection_file = self._get_model_selection_file_path()
        if not selection_file.exists():
            return None

        selected_filename = selection_file.read_text().strip()

        # Try to map filename to model_id for pre-configured models
        for model_id, info in PRECONFIGURED_MODELS.items():
            if info["filename"].lower() == selected_filename.lower():
                return model_id

        # For custom models, return the filename (or repo_id/filename format if applicable)
        return selected_filename

    def ensure_default_model_exists(self) -> bool:
        """Check if any model exists."""
        return any(self.models_dir.glob("*.gguf"))


# Singleton instance
llama_model_manager = LlamaModelManager()
