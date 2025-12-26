"""
Main unified LLM client supporting multiple providers.

This module provides AsyncLLMClient, a unified interface for:
- Ollama (local or remote)
- OpenAI-compatible APIs
- Local models via bundled Ollama
"""

import json
import logging
import os
from typing import Any, AsyncGenerator, Dict, List, Optional, Union

from unidecode import unidecode

from server.constants import DATA_DIR, IS_DOCKER
from server.database.config import config_manager
from server.database.connection import db

from .base import LLMProviderType
from .manager import LocalModelManager
from .providers.local import LocalLLMClient
from .providers.ollama import ollama_chat, ollama_ps
from .providers.openai import openai_compatible_chat
from .utils import is_arm_mac, repair_json

logger = logging.getLogger(__name__)


class AsyncLLMClient:
    """A unified client interface for LLM providers (Ollama, OpenAI-compatible, Local)."""

    def __init__(
        self,
        provider_type: Union[str, LLMProviderType],
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: int = 80,
        **local_kwargs,
    ):
        """
        Initialize the LLM client.

        Args:
            provider_type: The provider type ("ollama", "openai_compatible", or "local")
            base_url: Base URL for the API (not needed for local)
            api_key: API key (required for OpenAI, optional for others)
            timeout: Request timeout in seconds
            **local_kwargs: Additional arguments for local model initialization
        """
        if isinstance(provider_type, str):
            try:
                self.provider_type = LLMProviderType(provider_type.lower())
            except ValueError:
                raise ValueError(
                    f"Invalid provider type: {provider_type}. Must be 'ollama', 'openai_compatible', or 'local'"
                )
        else:
            self.provider_type = provider_type

        self.base_url = base_url.rstrip("/") if base_url else None
        self.api_key = api_key or "not-needed"
        self.timeout = timeout

        # Load extra body from environment variable if present
        self.extra_body = None
        extra_body_env = os.getenv("LLM_EXTRA_BODY")
        if extra_body_env:
            try:
                self.extra_body = json.loads(extra_body_env)
            except json.JSONDecodeError:
                logger.error(
                    f"Failed to parse LLM_EXTRA_BODY environment variable: {extra_body_env}"
                )

        # Initialize the appropriate client based on provider type
        if self.provider_type == LLMProviderType.LOCAL:
            self._client = LocalLLMClient(**local_kwargs)
        elif self.provider_type == LLMProviderType.OLLAMA:
            if not base_url:
                raise ValueError("base_url is required for Ollama provider")
            try:
                from ollama import AsyncClient as AsyncOllamaClient

                self._client = AsyncOllamaClient(host=self.base_url)
            except ImportError:
                raise ImportError(
                    "Ollama client not installed. Install with 'pip install ollama'"
                )
        else:
            # For OpenAI-compatible
            if not base_url:
                raise ValueError(
                    "base_url is required for OpenAI-compatible provider"
                )
            try:
                from openai import AsyncOpenAI

                self._client = AsyncOpenAI(
                    api_key=self.api_key,
                    base_url=f"{self.base_url}/v1",
                    timeout=timeout,
                    max_retries=0,
                )
            except ImportError:
                raise ImportError(
                    "OpenAI client not installed. Install with 'pip install openai'"
                )

    async def load_local_model(
        self, model_path_or_repo: str, filename: Optional[str] = None
    ) -> None:
        """Load a local model (only works with LOCAL provider)."""
        if self.provider_type != LLMProviderType.LOCAL:
            raise RuntimeError(
                "load_local_model only works with LOCAL provider"
            )

        await self._client.load_model(model_path_or_repo, filename)

    async def chat_with_structured_output(
        self,
        model: str,
        messages: List[Dict[str, str]],
        schema: Dict,
        options: Optional[Dict] = None,
    ) -> str:
        """
        Send a chat completion request with structured output.

        Args:
            model: Model name
            messages: List of message dictionaries
            schema: JSON schema for structured output
            options: Additional options for the model

        Returns:
            JSON string response
        """
        response_str = ""

        if self.provider_type == LLMProviderType.LOCAL:
            response_str = await self._client.chat_with_structured_output(
                messages, schema, **(options or {})
            )
        else:
            response = await self.chat(
                model=model, messages=messages, format=schema, options=options
            )

            # Convert to simple ASCII; handle emdashes
            response_str = unidecode(
                response["message"]["content"]
                .replace("—", "-")
                .replace("–", "-")
            )

        return repair_json(response_str)

    async def chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        format: Optional[Dict] = None,
        options: Optional[Dict] = None,
        tools: Optional[List[Dict]] = None,
        stream: bool = False,
    ) -> Union[Dict[str, Any], AsyncGenerator]:
        """Send a chat completion request."""

        if self.provider_type == LLMProviderType.LOCAL:
            if stream:
                return self._client.stream_chat(messages, **(options or {}))
            else:
                return await self._client.chat(messages, **(options or {}))
        elif self.provider_type == LLMProviderType.OLLAMA:
            return await ollama_chat(
                self._client, model, messages, format, options, tools, stream
            )
        else:
            return await openai_compatible_chat(
                self._client,
                model,
                messages,
                format,
                options,
                tools,
                stream,
                self.extra_body,
            )

    async def ps(self) -> Dict[str, Any]:
        """
        List models that are currently loaded into memory.

        For Ollama: Returns actual running models
        For OpenAI-compatible: Returns a graceful fallback response

        Returns:
            Dictionary with models information
        """

        if self.provider_type == LLMProviderType.LOCAL:
            models = []
            if (
                hasattr(self._client, "_current_model")
                and self._client._current_model
            ):
                models.append(
                    {
                        "name": self._client._current_model,
                        "model": self._client._current_model,
                        "size": 0,  # Size info not readily available
                        "digest": "",
                        "details": {
                            "format": "gguf",
                            "family": "llama",
                            "families": ["llama"],
                            "parameter_size": "unknown",
                            "quantization_level": "unknown",
                        },
                    }
                )

        elif self.provider_type == LLMProviderType.OLLAMA:
            return await ollama_ps(self.base_url, self.timeout)
        else:
            # For OpenAI-compatible providers, we can't get "running" models
            # Return a graceful response indicating this feature isn't available
            return {
                "models": [],
                "message": "Model process information not available for OpenAI-compatible providers",
                "provider_type": self.provider_type.value,
            }


def get_llm_client():
    """Create and return an LLM client with configuration from config manager."""
    config = config_manager.get_config()
    provider_type = config.get("LLM_PROVIDER", "ollama").lower()
    base_url = config.get("LLM_BASE_URL")
    api_key = config.get("LLM_API_KEY", None)

    if provider_type == "local":
        # For local provider, use Ollama pointing to bundled instance
        return AsyncLLMClient(
            provider_type="ollama",
            base_url="http://127.0.0.1:11434",  # Bundled Ollama URL
        )
    else:
        return AsyncLLMClient(
            provider_type=provider_type, base_url=base_url, api_key=api_key
        )
