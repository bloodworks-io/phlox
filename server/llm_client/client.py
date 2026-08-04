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
from server.utils.languages import get_language_name
from server.utils.url_utils import normalize_openai_base_url

from .providers.openai import openai_compatible_chat
from .utils import repair_json

logger = logging.getLogger(__name__)


class AsyncLLMClient:
    """A unified client interface for OpenAI-compatible and local providers."""

    def __init__(
        self,
        provider_type: str,
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
        self.provider_type = provider_type.lower()

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
            raise ImportError(
                "OpenAI client not installed. Install with 'pip install openai'"
            ) from error

    async def chat_with_structured_output(
        self,
        model: str,
        messages: list[dict[str, Any]],
        schema: dict[str, Any],
        options: dict[str, Any] | None = None,
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

        # chat() with stream=False always returns dict
        if isinstance(response, dict):
            message_content = response["message"]["content"]  # ty: ignore
        else:
            raise RuntimeError("Expected dict response, got async generator")

        # Handle emdashes and en-dashes (can cause JSON parsing issues)
        # Preserve UTF-8 characters for international language support
        response_str = message_content.replace("—", "-").replace("–", "-")

        return repair_json(response_str)

    async def chat(
        self,
        model: str,
        messages: list[dict[str, Any]],
        format: dict[str, Any] | None = None,
        options: dict[str, Any] | None = None,
        tools: list[dict[str, Any]] | None = None,
        stream: bool = False,
    ) -> Union[dict[str, Any], AsyncGenerator]:
        """Send a chat completion request."""
        from .utils import ensure_system_messages_first

        messages = ensure_system_messages_first(messages)
        messages = self._with_language_directive(messages)

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

    def _with_language_directive(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Prepend an output-language directive when a non-English language is set."""
        try:
            language = config_manager.get_user_settings().get("preferred_language", "en")
        except Exception:
            return messages

        if not language or language == "en":
            return messages

        name = get_language_name(language)
        directive = (
            f"You are operating in a {name}-speaking clinical setting. "
            "All output content (notes, letters, summaries, chat responses, and JSON field "
            f"values) must be written in {name}, regardless of the language of any source "
            "materials. Do not rename JSON keys."
        )

        if messages and messages[0].get("role") == "system":
            merged = {**messages[0], "content": f"{directive}\n\n{messages[0].get('content', '')}"}
            return [merged, *messages[1:]]
        return [{"role": "system", "content": directive}, *messages]


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
        provider_type = "openai"
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
