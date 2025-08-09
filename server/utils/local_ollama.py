import json
import aiohttp
import asyncio
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)


class LocalOllamaClient:
    def __init__(self, base_url: str = "http://127.0.0.1:11434"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def _ensure_session(self):
        if not self.session:
            self.session = aiohttp.ClientSession()

    async def list_models(self) -> List[Dict[str, Any]]:
        await self._ensure_session()
        try:
            async with self.session.get(
                f"{self.base_url}/api/tags"
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("models", [])
                return []
        except Exception as e:
            logger.error(f"Failed to list Ollama models: {e}")
            return []

    async def pull_model(self, model_name: str) -> bool:
        """Pull a model from Ollama registry"""
        await self._ensure_session()
        try:
            payload = {"name": model_name}
            async with self.session.post(
                f"{self.base_url}/api/pull", json=payload
            ) as response:
                if response.status == 200:
                    # Stream the response to track progress
                    async for line in response.content:
                        if line:
                            try:
                                status = json.loads(line.decode())
                                logger.info(f"Pull progress: {status}")
                            except json.JSONDecodeError:
                                continue
                    return True
                return False
        except Exception as e:
            logger.error(f"Failed to pull model {model_name}: {e}")
            return False

    async def generate(self, model: str, prompt: str, **kwargs) -> str:
        """Generate text using Ollama"""
        await self._ensure_session()
        try:
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                **kwargs,
            }
            async with self.session.post(
                f"{self.base_url}/api/generate", json=payload
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("response", "")
                return ""
        except Exception as e:
            logger.error(f"Failed to generate with model {model}: {e}")
            return ""

    async def embeddings(self, model: str, prompt: str) -> List[float]:
        """Generate embeddings using Ollama"""
        await self._ensure_session()
        try:
            payload = {"model": model, "prompt": prompt}
            async with self.session.post(
                f"{self.base_url}/api/embeddings", json=payload
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("embedding", [])
                return []
        except Exception as e:
            logger.error(
                f"Failed to generate embeddings with model {model}: {e}"
            )
            return []

    async def is_healthy(self) -> bool:
        """Check if Ollama is running and healthy"""
        await self._ensure_session()
        try:
            async with self.session.get(
                f"{self.base_url}/api/tags"
            ) as response:
                return response.status == 200
        except Exception:
            return False
