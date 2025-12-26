"""Local model manager for Ollama model lifecycle management."""

import logging

logger = logging.getLogger(__name__)


class LocalModelManager:
    """Manages local models through bundled Ollama."""

    def __init__(self, ollama_url: str = "http://127.0.0.1:11434"):
        self.ollama_url = ollama_url

    async def _ollama_request(
        self, endpoint: str, method: str = "GET", json_data=None
    ):
        """Make request to local Ollama instance."""
        import aiohttp

        async with aiohttp.ClientSession() as session:
            url = f"{self.ollama_url}/api/{endpoint}"
            if method == "GET":
                async with session.get(url) as response:
                    return (
                        await response.json()
                        if response.status == 200
                        else None
                    )
            elif method == "POST":
                async with session.post(url, json=json_data) as response:
                    return (
                        await response.json()
                        if response.status == 200
                        else None
                    )

    async def list_models(self):
        """List available models in Ollama."""
        result = await self._ollama_request("tags")
        return result.get("models", []) if result else []

    async def is_model_available(self, model_name: str) -> bool:
        """Check if model is available in Ollama."""
        models = await self.list_models()
        return any(model["name"] == model_name for model in models)

    async def pull_model(self, model_name: str, progress_callback=None):
        """Pull model using Ollama."""
        import aiohttp

        async with aiohttp.ClientSession() as session:
            url = f"{self.ollama_url}/api/pull"
            data = {"name": model_name}

            async with session.post(url, json=data) as response:
                if response.status == 200:
                    async for line in response.content:
                        if line and progress_callback:
                            try:
                                import json

                                status = json.loads(line.decode())
                                progress_callback(status)
                            except:
                                continue
                    return True
        return False

    async def delete_model(self, model_name: str):
        """Delete model from Ollama."""
        import aiohttp

        async with aiohttp.ClientSession() as session:
            url = f"{self.ollama_url}/api/delete"
            data = {"name": model_name}
            async with session.delete(url, json=data) as response:
                return response.status == 200
