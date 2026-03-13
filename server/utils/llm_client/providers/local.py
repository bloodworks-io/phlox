"""Local LLM provider using bundled Ollama."""

import logging

logger = logging.getLogger(__name__)


class LocalLLMClient:
    """Local LLM client using bundled Ollama."""

    def __init__(self, ollama_url: str = "http://127.0.0.1:11434"):
        self.ollama_url = ollama_url
        self.current_model = None

    async def load_model(self, model_name: str) -> None:
        """Load model in Ollama (models are auto-loaded on first use)."""
        from ..manager import LocalModelManager

        manager = LocalModelManager(self.ollama_url)
        if not await manager.is_model_available(model_name):
            raise FileNotFoundError(f"Model {model_name} not found. Pull it first.")
        self.current_model = model_name

    async def chat(self, messages, **kwargs):
        """Chat using Ollama API."""
        if not self.current_model:
            raise ValueError("No model loaded")

        # Convert messages to Ollama format
        prompt = self._messages_to_prompt(messages)

        import httpx

        async with httpx.AsyncClient(timeout=httpx.Timeout(600.0)) as client:
            url = f"{self.ollama_url}/api/generate"
            data = {
                "model": self.current_model,
                "prompt": prompt,
                "stream": False,
                **kwargs,
            }

            response = await client.post(url, json=data)
            if response.status_code == 200:
                result = response.json()
                return result.get("response", "")
        return ""

    def _messages_to_prompt(self, messages):
        """Convert OpenAI-style messages to prompt."""
        prompt_parts = []
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role == "system":
                prompt_parts.append(f"System: {content}")
            elif role == "user":
                prompt_parts.append(f"User: {content}")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}")
        return "\n".join(prompt_parts) + "\nAssistant: "
