"""
Main unified LLM client supporting OpenAI-compatible providers.

This module provides AsyncLLMClient, a unified interface for:
- OpenAI-compatible APIs (including Ollama's OpenAI endpoint)
- Local models via bundled llama.cpp server (exposed through an OpenAI-style API)
"""

import json
import logging
import os
from collections.abc import AsyncGenerator
from typing import Any, Union

from server.database.config.manager import config_manager
from server.utils.url_utils import normalize_openai_base_url

from .base import LLMProviderType
from .providers.openai import openai_compatible_chat
from .utils import repair_json

logger = logging.getLogger(__name__)


class AsyncLLMClient:
    """A unified client interface for OpenAI-compatible and local providers."""

    def __init__(
        self,
        provider_type: Union[str, LLMProviderType],
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: int = 80,
    ):
        """
        Initialize the LLM client.

        Args:
            provider_type: The provider type ("openai" or "local")
            base_url: Base URL for the API
            api_key: API key (required for some providers)
            timeout: Request timeout in seconds
        """
        if isinstance(provider_type, str):
            try:
                self.provider_type = LLMProviderType(provider_type.lower())
            except ValueError as error:
                raise ValueError(
                    f"Invalid provider type: {provider_type}. Must be 'openai' or 'local'"
                ) from error
        else:
            self.provider_type = provider_type

        if base_url:
            self.base_url = normalize_openai_base_url(base_url)
        else:
            self.base_url = None
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
                    "Failed to parse LLM_EXTRA_BODY environment variable: %s", extra_body_env
                )

        if not self.base_url:
            raise ValueError("base_url is required for OpenAI-compatible provider")

        try:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=f"{self.base_url}/v1",
                timeout=timeout,
                max_retries=0,
            )
        except ImportError as error:
            raise ImportError("OpenAI client not installed. Install with 'pip install openai'") from error

    async def chat_with_structured_output(
        self,
        model: str,
        messages: list[dict[str, str]],
        schema: dict,
        options: dict | None = None,
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
        response = await self.chat(model=model, messages=messages, format=schema, options=options)

        # Handle emdashes and ensure ascii
        response_str = (
            response["message"]["content"]
            .replace("—", "-")
            .replace("–", "-")
            .encode("ascii", "ignore")
            .decode("ascii")
        )

        return repair_json(response_str)

    async def chat(
        self,
        model: str,
        messages: list[dict[str, str]],
        format: dict | None = None,
        options: dict | None = None,
        tools: list[dict] | None = None,
        stream: bool = False,
    ) -> Union[dict[str, Any], AsyncGenerator]:
        """Send a chat completion request."""
        from .utils import ensure_system_messages_first

        messages = ensure_system_messages_first(messages)

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

    async def ps(self) -> dict[str, Any]:
        """
        List models that are currently loaded into memory.

        For OpenAI-compatible providers, this returns a graceful fallback response.

        Returns:
            Dictionary with models information
        """
        return {
            "models": [],
            "message": "Model process information not available for OpenAI-compatible providers",
            "provider_type": self.provider_type.value,
        }


def get_llm_client(timeout: int = 80):
    """Create and return an LLM client with configuration from config manager.

    Args:
        timeout: Request timeout in seconds (default: 80)
    """
    config = config_manager.get_config()
    provider_type = (config.get("LLM_PROVIDER", "openai") or "openai").lower()
    base_url = config.get("LLM_BASE_URL")
    api_key = config.get("LLM_API_KEY", None)

    if provider_type == "local":
        # For local provider, use llama-server via OpenAI-compatible API.
        from server.utils.allocated_ports import get_llama_port

        base_url = f"http://127.0.0.1:{get_llama_port()}"
        provider_type = LLMProviderType.OPENAI_COMPATIBLE.value
    else:
        # Default endpoint remains Ollama's default host, accessed via /v1 API.
        if not base_url:
            base_url = "http://127.0.0.1:11434"

    return AsyncLLMClient(
        provider_type=provider_type,
        base_url=base_url,
        api_key=api_key,
        timeout=timeout,
    )
