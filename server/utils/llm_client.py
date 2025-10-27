import aiohttp
import json
from unidecode import unidecode
import re
import logging
import os
import platform
from pathlib import Path
import asyncio
from typing import Dict, List, Any, Optional, Union, AsyncGenerator
from server.database.config import config_manager
from server.constants import DATA_DIR, IS_DOCKER
from enum import Enum
from server.database.connection import db

logger = logging.getLogger(__name__)


class LLMProviderType(Enum):
    OLLAMA = "ollama"
    OPENAI_COMPATIBLE = "openai"
    LOCAL = "local"


# Models that support/require thinking steps
class ModelThinkingBehavior(Enum):
    NONE = "none"
    TAGS = "tags"  # model emits <think>/<thinking>/<reasoning> tags in content
    FIELD = "field"  # model returns separate reasoning field (e.g., reasoning_content)


def get_model_thinking_behavior(model_name: str) -> ModelThinkingBehavior:
    """
    Dynamic behavior lookup:
    - Use stored DB probe if available.
    - Fallback to name heuristic.
    """
    config = config_manager.get_config()
    provider = config.get("LLM_PROVIDER", "ollama").lower()
    rec = db.get_model_capability(provider, model_name) if model_name else None
    if rec:
        cap = rec.get("capability_type", "none")
        if cap == "tags":
            return ModelThinkingBehavior.TAGS
        if cap == "field":
            return ModelThinkingBehavior.FIELD
        return ModelThinkingBehavior.NONE
    return _fallback_behavior_from_name(model_name)


def is_thinking_model(model_name: str) -> bool:
    """Backwards compatibility: True only for 'tags' behavior."""
    return get_model_thinking_behavior(model_name) == ModelThinkingBehavior.TAGS


def add_thinking_guidance_to_messages(
    messages: List[Dict[str, str]], model_name: str
) -> List[Dict[str, str]]:
    behavior = get_model_thinking_behavior(model_name)
    if behavior == ModelThinkingBehavior.NONE:
        return messages

    # You can keep one guidance text, or tailor it per behavior
    content = "Keep your reasoning concise and focused. Don't overthink the task - provide just enough reasoning to arrive at a good solution."

    thinking_guidance = {
        "role": "system",
        "content": content,
    }
    return messages + [thinking_guidance]


def add_thinking_to_schema(base_schema: dict, model_name: str) -> dict:
    """Add thinking field to schema if model supports thinking."""
    if not is_thinking_model(model_name):
        return base_schema

    # Create a copy of the schema
    thinking_schema = base_schema.copy()

    # Create new properties dict with thinking first
    new_properties = {
        "thinking": {
            "type": "string",
            "description": "Internal reasoning and thought process before providing the final response",
        }
    }

    # Add existing properties after thinking
    if "properties" in thinking_schema:
        new_properties.update(thinking_schema["properties"])

    thinking_schema["properties"] = new_properties

    # Update required fields - thinking should be first in required too
    if "required" in thinking_schema:
        thinking_schema["required"] = ["thinking"] + thinking_schema["required"]
    else:
        thinking_schema["required"] = ["thinking"]

    return thinking_schema


def is_arm_mac() -> bool:
    """Check if we're running on an ARM Mac."""
    return platform.system() == "Darwin" and platform.machine() == "arm64"


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


class LocalLLMClient:
    """Local LLM client using bundled Ollama."""

    def __init__(self, ollama_url: str = "http://127.0.0.1:11434"):
        self.ollama_url = ollama_url
        self.current_model = None

    async def load_model(self, model_name: str) -> None:
        """Load model in Ollama (models are auto-loaded on first use)."""
        manager = LocalModelManager(self.ollama_url)
        if not await manager.is_model_available(model_name):
            raise FileNotFoundError(
                f"Model {model_name} not found. Pull it first."
            )
        self.current_model = model_name

    async def chat(self, messages, **kwargs):
        """Chat using Ollama API."""
        if not self.current_model:
            raise ValueError("No model loaded")

        # Convert messages to Ollama format
        prompt = self._messages_to_prompt(messages)

        import aiohttp

        async with aiohttp.ClientSession() as session:
            url = f"{self.ollama_url}/api/generate"
            data = {
                "model": self.current_model,
                "prompt": prompt,
                "stream": False,
                **kwargs,
            }
            async with session.post(url, json=data) as response:
                if response.status == 200:
                    result = await response.json()
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
        Send a chat completion request with structured output, handling thinking models properly.

        For thinking models:
        - Ollama: 3-step approach with explicit transition
        - Other providers: 2-call approach

        For non-thinking models, this does a single structured output call.

        Args:
            model: Model name
            messages: List of message dictionaries
            schema: JSON schema for structured output
            options: Additional options for the model

        Returns:
            JSON string response
        """
        if self.provider_type == LLMProviderType.LOCAL:
            return await self._client.chat_with_structured_output(
                messages, schema, **(options or {})
            )


        if not is_thinking_model(model):
            # Non-thinking models: single structured call
            response = await self.chat(
                model=model, messages=messages, format=schema, options=options
            )

            # Convert to simple ASCII; handle emdashes
            return unidecode(response["message"]["content"].replace("—", "-").replace("–", "-"))

        logging.info("Model with think tags called")

        # Thinking models: different approaches for different providers
        if self.provider_type == LLMProviderType.OLLAMA:
            return await self._ollama_thinking_structured_output(
                model, messages, schema, options
            )
        else:
            return await self._openai_thinking_structured_output(
                model, messages, schema, options
            )

    async def _ollama_thinking_structured_output(
        self,
        model: str,
        messages: List[Dict[str, str]],
        schema: Dict,
        options: Optional[Dict] = None,
    ) -> str:
        """
        Handle thinking models for Ollama with explicit transition.
        """
        # Add thinking guidance
        guided_messages = add_thinking_guidance_to_messages(messages, model)

        # First call: get thinking
        thinking_messages = guided_messages.copy()

        # First call: get thinking
        thinking_messages = messages.copy()
        thinking_messages.append({"role": "assistant", "content": "<think>"})

        thinking_options = (options or {}).copy()
        thinking_options["stop"] = ["</think>"]

        thinking_response = await self.chat(
            model=model, messages=thinking_messages, options=thinking_options
        )

        content = thinking_response["message"]["content"]
        thinking_content = (
            ("" if content.startswith("<think>") else "<think>")
            + content
            + ("" if content.endswith("</think>") else "</think>")
        )

        # Build conversation with explicit transition for Ollama
        final_messages = messages.copy()
        final_messages.append(
            {
                "role": "assistant",
                "content": thinking_content
                + "\n\nI have a plan for how I will tackle this problem.",
            }
        )
        final_messages.append(
            {
                "role": "user",
                "content": "Please go ahead. Answer in JSON format according to the specified schema.",
            }
        )

        final_response = await self.chat(
            model=model, messages=final_messages, format=schema, options=options
        )

        # Convert to simple ASCII; handle emdashes
        return unidecode(final_response["message"]["content"].replace("—", "-").replace("–", "-"))

    async def _openai_thinking_structured_output(
        self,
        model: str,
        messages: List[Dict[str, str]],
        schema: Dict,
        options: Optional[Dict] = None,
    ) -> str:
        """
        Handle thinking models for OpenAI-compatible providers.
        """
        # Add thinking guidance
        guided_messages = add_thinking_guidance_to_messages(messages, model)

        # First call: get thinking
        thinking_messages = guided_messages.copy()

        # First call: get thinking
        thinking_messages = messages.copy()
        thinking_messages.append({"role": "assistant", "content": "<think>"})

        thinking_options = (options or {}).copy()
        thinking_options["stop"] = ["</think>"]

        thinking_response = await self.chat(
            model=model, messages=thinking_messages, options=thinking_options
        )

        content = thinking_response["message"]["content"]
        thinking_content = (
            ("" if content.startswith("<think>") else "<think>")
            + content
            + ("" if content.endswith("</think>") else "</think>")
        )

        # Second call: structured output with thinking
        final_messages = messages.copy()
        final_messages.append(
            {"role": "assistant", "content": thinking_content}
        )

        final_response = await self.chat(
            model=model, messages=final_messages, format=schema, options=options
        )

        # Convert to simple ASCII; handle emdashes
        return unidecode(final_response["message"]["content"].replace("—", "-").replace("–", "-"))

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
        # Add thinking guidance for thinking models
        guided_messages = add_thinking_guidance_to_messages(messages, model)

        if self.provider_type == LLMProviderType.LOCAL:
            if stream:
                return self._client.stream_chat(
                    guided_messages, **(options or {})
                )
            else:
                return await self._client.chat(
                    guided_messages, **(options or {})
                )
        elif self.provider_type == LLMProviderType.OLLAMA:
            return await self._ollama_chat(
                model, guided_messages, format, options, tools, stream
            )
        else:
            return await self._openai_compatible_chat(
                model, guided_messages, format, options, tools, stream
            )

    async def _ollama_chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        format: Optional[Dict] = None,
        options: Optional[Dict] = None,
        tools: Optional[List[Dict]] = None,
        stream: bool = False,
    ) -> Union[Dict[str, Any], AsyncGenerator]:
        """Send chat request to Ollama."""
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "format": format,
                "options": options,
            }

            if tools:
                kwargs["tools"] = tools

            if stream:
                kwargs["stream"] = stream
                return await self._client.chat(**kwargs)
            else:
                result = await self._client.chat(**kwargs)

                return result
        except Exception as e:
            logger.error(f"Error in Ollama chat request: {e}")
            raise

    async def _openai_compatible_chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        format: Optional[Dict] = None,
        options: Optional[Dict] = None,
        tools: Optional[List[Dict]] = None,
        stream: bool = False,
    ) -> Union[Dict[str, Any], AsyncGenerator]:
        """Send chat request to OpenAI-compatible API using the OpenAI client."""
        try:
            # Prepare parameters for OpenAI
            params = {
                "model": model,
                "messages": messages,
            }

            if tools:
                params["tools"] = tools
                # Only force tool choice to required if explicitly specified
                if options and options.get("force_tools", False):
                    params["tool_choice"] = "required"

            # Map options from our format to OpenAI format
            if options:
                # Direct mappings
                if "temperature" in options:
                    params["temperature"] = options["temperature"]
                # if "num_ctx" in options:
                # params["max_tokens"] = options["num_ctx"]  # Closest equivalent
                # Handle stop tokens
                if "stop" in options:
                    params["stop"] = options["stop"]

            # Handle format (for JSON responses)
            if format:
                params["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {"name": "field_response", "schema": format},
                }

            # Add stream parameter if needed
            if stream:
                params["stream"] = stream

                # For streaming, return an async generator
                async def response_generator():
                    async for (
                        chunk
                    ) in await self._client.chat.completions.create(**params):
                        # Format the response to match Ollama's format
                        if hasattr(chunk, "choices") and chunk.choices:
                            delta = chunk.choices[0].delta
                            content = (
                                delta.content
                                if hasattr(delta, "content") and delta.content
                                else ""
                            )

                            # Check for tool calls in the delta
                            tool_calls = None
                            if (
                                hasattr(delta, "tool_calls")
                                and delta.tool_calls
                            ):
                                tool_calls = delta.tool_calls

                            response = {
                                "model": model,
                                "message": {
                                    "role": "assistant",
                                    "content": content,
                                },
                            }

                            # Add tool_calls if present
                            if tool_calls:
                                response["message"]["tool_calls"] = tool_calls

                            yield response

                return response_generator()
            else:
                # Make the API call

                response = await self._client.chat.completions.create(**params)

                # Convert to Ollama-like format for consistency
                content = response.choices[0].message.content or ""

                result = {
                    "model": model,
                    "message": {
                        "role": "assistant",
                        "content": content,
                    },
                }

                # Preserve reasoning_content if provided by the backend
                try:
                    reasoning_content = getattr(
                        response.choices[0].message, "reasoning_content", None
                    )
                    if reasoning_content:
                        result["message"][
                            "reasoning_content"
                        ] = reasoning_content
                except Exception:
                    pass

                # Add tool_calls if present
                if (
                    hasattr(response.choices[0].message, "tool_calls")
                    and response.choices[0].message.tool_calls
                ):
                    result["message"]["tool_calls"] = []
                    for tool_call in response.choices[0].message.tool_calls:
                        result["message"]["tool_calls"].append(
                            {
                                "id": tool_call.id,
                                "type": tool_call.type,
                                "function": {
                                    "name": tool_call.function.name,
                                    "arguments": tool_call.function.arguments,
                                },
                            }
                        )

                return result
        except Exception as e:
            logger.error(f"Error in OpenAI-compatible chat request: {e}")
            raise

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
            try:
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as session:
                    async with session.get(
                        f"{self.base_url}/api/ps"
                    ) as response:
                        if response.status == 200:
                            result = await response.json()
                            return result
                        else:
                            error_text = await response.text()
                            logger.error(
                                f"Ollama ps request failed with status {response.status}: {error_text}"
                            )
                            return {
                                "models": [],
                                "error": f"Request failed with status {response.status}",
                            }
            except Exception as e:
                logger.error(
                    f"Unexpected error getting Ollama process info: {e}"
                )
                return {"models": [], "error": f"Unexpected error: {str(e)}"}
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
