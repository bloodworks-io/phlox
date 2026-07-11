"""Embedding model management."""

from __future__ import annotations

import logging
import time
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path

import httpx

from server.constants import DATA_DIR

logger = logging.getLogger(__name__)

EMBEDDING_REPO = "Qwen/Qwen3-Embedding-0.6B-GGUF"
EMBEDDING_FILENAME = "Qwen3-Embedding-0.6B-Q8_0.gguf"
EMBEDDING_SIZE_MB = 639

EMBEDDING_MODELS_DIR = DATA_DIR / "embedding_models"
EMBEDDING_MODELS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class DownloadProgress:
    """Progress information for the embedding model download."""

    percentage: float
    downloaded_bytes: int
    total_bytes: int
    speed_bytes_per_sec: float
    eta_seconds: float | None


def embedding_model_path() -> Path:
    """Absolute path where the embedding GGUF lives."""
    return EMBEDDING_MODELS_DIR / EMBEDDING_FILENAME


def is_embedding_model_downloaded() -> bool:
    """Whether the embedding model file is present on disk."""
    return embedding_model_path().exists()


def get_downloaded_size_mb() -> float | None:
    """Return the downloaded model size in MB, or None if not present."""
    model_file = embedding_model_path()
    if model_file.exists():
        return round(model_file.stat().st_size / (1024 * 1024), 1)
    return None


async def download_embedding_model(progress_callback=None) -> Path:
    # Download the embedding GGUF via streaming HTTP.
    model_file = embedding_model_path()
    url = f"https://huggingface.co/{EMBEDDING_REPO}/resolve/main/{EMBEDDING_FILENAME}"
    logger.info("Downloading %s from %s", EMBEDDING_FILENAME, EMBEDDING_REPO)

    timeout = httpx.Timeout(600.0)
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

                    current_time = time.time()
                    if progress_callback and total_size and (current_time - last_update_time) > 0.5:
                        speed = (downloaded - last_downloaded) / (current_time - last_update_time)
                        eta = (total_size - downloaded) / speed if speed > 0 else None
                        await progress_callback(
                            DownloadProgress(
                                percentage=(downloaded / total_size) * 100,
                                downloaded_bytes=downloaded,
                                total_bytes=total_size,
                                speed_bytes_per_sec=speed,
                                eta_seconds=eta,
                            )
                        )
                        last_update_time = current_time
                        last_downloaded = downloaded

        if progress_callback and total_size:
            await progress_callback(
                DownloadProgress(
                    percentage=100.0,
                    downloaded_bytes=total_size,
                    total_bytes=total_size,
                    speed_bytes_per_sec=0,
                    eta_seconds=0,
                )
            )

        logger.info("Successfully downloaded %s to %s", EMBEDDING_FILENAME, model_file)

    except Exception:
        # Clean up partial downloads on failure.
        with suppress(Exception):
            if model_file.exists():
                model_file.unlink()
        raise

    return model_file


def delete_embedding_model() -> bool:
    """Delete the embedding model file. Returns True if a file was removed."""
    model_file = embedding_model_path()
    if model_file.exists():
        model_file.unlink()
        logger.info("Deleted embedding model %s", EMBEDDING_FILENAME)
        return True
    return False
