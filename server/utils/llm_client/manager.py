"""Local model manager for GGUF model file listing."""

import logging
from pathlib import Path
from typing import Dict, List

from server.constants import DATA_DIR

logger = logging.getLogger(__name__)


class LocalModelManager:
    """Manages local GGUF models by scanning the models directory."""

    def __init__(self):
        # Models stored in DATA_DIR/llm_models
        self.models_dir = DATA_DIR / "llm_models"
        self.models_dir.mkdir(parents=True, exist_ok=True)

    async def list_models(self) -> List[Dict]:
        """List available GGUF models in the models directory."""
        models = []

        # First, check if we have a model selection file
        selection_file = DATA_DIR / "llm_model.txt"
        selected_filename = None
        if selection_file.exists():
            selected_filename = selection_file.read_text().strip()

        for model_file in self.models_dir.glob("*.gguf"):
            size_bytes = model_file.stat().st_size
            size_mb = round(size_bytes / (1024 * 1024), 1)
            filename = model_file.name

            models.append(
                {
                    "name": filename,
                    "filename": filename,
                    "size": size_bytes,
                    "size_mb": size_mb,
                    "modified_at": model_file.stat().st_mtime,
                    "path": str(model_file),
                    "is_selected": selected_filename == filename,
                }
            )

        return sorted(models, key=lambda m: m["size"])

    async def is_model_available(self, filename: str) -> bool:
        """Check if a model file exists."""
        model_path = self.models_dir / filename
        return model_path.exists()

    def get_model_path(self, repo_id: str, filename: str) -> str:
        """Get the full path to a model file."""
        # repo_id is ignored for GGUF files, we use the flat structure
        model_path = self.models_dir / filename
        if model_path.exists():
            return str(model_path)
        return None

    async def pull_model(self, model_name: str, progress_callback=None):
        """Pull model - not supported for GGUF files (use download_model instead)."""
        raise NotImplementedError(
            "pull_model is not supported for GGUF files. "
            "Use the download_model API endpoint instead."
        )

    async def delete_model(self, filename: str):
        """Delete a model file."""
        model_path = self.models_dir / filename
        if model_path.exists():
            model_path.unlink()
            # Also clean up the model selection file if it exists
            selection_file = DATA_DIR / "llm_model.txt"
            if selection_file.exists():
                try:
                    selection_file.unlink()
                except Exception:
                    pass
            return True
        return False
