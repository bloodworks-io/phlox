import aiohttp
import json
import logging
from typing import Dict, List, Any, Optional, Union, AsyncGenerator
from server.database.config import config_manager
from enum import Enum

logger = logging.getLogger(__name__)

class LLMProviderType(Enum):
    OLLAMA = "ollama"
    OPENAI_COMPATIBLE = "openai"

# Models that support/require thinking steps
THINKING_MODELS = [
    "qwen3",
    "deespeek-r"
]

def is_thinking_model(model_name: str) -> bool:
    """Check if a model requires thinking steps."""
    if not model_name:
        return False
    model_lower = model_name.lower()
    return any(thinking_model in model_lower for thinking_model in THINKING_MODELS)

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
            "description": "Internal reasoning and thought process before providing the final response"
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

class AsyncLLMClient:
    """A unified client interface for LLM providers (Ollama, OpenAI-compatible endpoints)."""

    def __init__(self,
            provider_type: Union[str, LLMProviderType],
            base_url: str,
            api_key: Optional[str] = None,
            timeout: int = 120):
        """
        Initialize the LLM client.

        Args:
            provider_type: The provider type ("ollama" or "openai_compatible")
            base_url: Base URL for the API
            api_key: API key (required for OpenAI, optional for others)
            timeout: Request timeout in seconds
        """
        if isinstance(provider_type, str):
            try:
                self.provider_type = LLMProviderType(provider_type.lower())
            except ValueError:
                raise ValueError(f"Invalid provider type: {provider_type}. Must be 'ollama' or 'openai_compatible'")
        else:
            self.provider_type = provider_type

        self.base_url = base_url.rstrip("/")
        self.api_key = api_key or "not-needed"
        self.timeout = timeout

        # Initialize the appropriate client based on provider type
        if self.provider_type == LLMProviderType.OLLAMA:
            try:
                from ollama import AsyncClient as AsyncOllamaClient
                self._client = AsyncOllamaClient(host=self.base_url)
            except ImportError:
                raise ImportError("Ollama client not installed. Install with 'pip install ollama'")
        else:
            # For OpenAI-compatible, use the official OpenAI client
            try:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(
                    api_key=self.api_key,
                    base_url=f"{self.base_url}/v1",  # OpenAI client expects /v1 in base_url
                    timeout=timeout
                )
            except ImportError:
                raise ImportError("OpenAI client not installed. Install with 'pip install openai'")

    async def chat_with_structured_output(self,
                                        model: str,
                                        messages: List[Dict[str, str]],
                                        schema: Dict,
                                        options: Optional[Dict] = None) -> str:
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
        if not is_thinking_model(model):
            # Non-thinking models: single structured call
            response = await self.chat(
                model=model,
                messages=messages,
                format=schema,
                options=options
            )
            return response["message"]["content"]

        # Thinking models: different approaches for different providers
        if self.provider_type == LLMProviderType.OLLAMA:
            return await self._ollama_thinking_structured_output(model, messages, schema, options)
        else:
            return await self._openai_thinking_structured_output(model, messages, schema, options)

    async def _ollama_thinking_structured_output(self,
                                               model: str,
                                               messages: List[Dict[str, str]],
                                               schema: Dict,
                                               options: Optional[Dict] = None) -> str:
        """
        Handle thinking models for Ollama with explicit transition.
        """
        # First call: get thinking
        thinking_messages = messages.copy()
        thinking_messages.append({
            "role": "assistant",
            "content": "<think>"
        })

        thinking_options = (options or {}).copy()
        thinking_options["stop"] = ["</think>"]

        thinking_response = await self.chat(
            model=model,
            messages=thinking_messages,
            options=thinking_options
        )

        thinking_content = "<think>" + thinking_response["message"]["content"] + "</think>"

        # Build conversation with explicit transition for Ollama
        final_messages = messages.copy()
        final_messages.append({
            "role": "assistant",
            "content": thinking_content + "\n\nI have a plan for how I will tackle this problem."
        })
        final_messages.append({
            "role": "user",
            "content": "Please go ahead. Answer in JSON format according to the specified schema."
        })

        final_response = await self.chat(
            model=model,
            messages=final_messages,
            format=schema,
            options=options
        )

        return final_response["message"]["content"]

    async def _openai_thinking_structured_output(self,
            model: str,
            messages: List[Dict[str, str]],
            schema: Dict,
            options: Optional[Dict] = None) -> str:
        """
        Handle thinking models for OpenAI-compatible providers.
        """
        # First call: get thinking
        thinking_messages = messages.copy()
        thinking_messages.append({
            "role": "assistant",
            "content": "<think>"
        })

        thinking_options = (options or {}).copy()
        thinking_options["stop"] = ["</think>"]

        thinking_response = await self.chat(
            model=model,
            messages=thinking_messages,
            options=thinking_options
        )

        thinking_content = "<think>" + thinking_response["message"]["content"] + "</think>"

        # Second call: structured output with thinking
        final_messages = messages.copy()
        final_messages.append({
            "role": "assistant",
            "content": thinking_content
        })

        final_response = await self.chat(
            model=model,
            messages=final_messages,
            format=schema,
            options=options
        )
        print(final_response,flush=True)
        return final_response["message"]["content"]

    async def chat(self,
            model: str,
            messages: List[Dict[str, str]],
            format: Optional[Dict] = None,
            options: Optional[Dict] = None,
            tools: Optional[List[Dict]] = None,
            stream: bool = False) -> Union[Dict[str, Any], AsyncGenerator]:
        """
        Send a chat completion request.

        Args:
            model: Model name
            messages: List of message dictionaries with 'role' and 'content'
            format: Format specification (Ollama-specific)
            options: Additional options for the model
            tools: Optional list of tools/functions for function calling
            stream: Whether to stream the response

        Returns:
            Response dictionary or async generator for streaming
        """
        if self.provider_type == LLMProviderType.OLLAMA:
            return await self._ollama_chat(model, messages, format, options, tools, stream)
        else:
            return await self._openai_compatible_chat(model, messages, format, options, tools, stream)

    async def _ollama_chat(self,
            model: str,
            messages: List[Dict[str, str]],
            format: Optional[Dict] = None,
            options: Optional[Dict] = None,
            tools: Optional[List[Dict]] = None,
            stream: bool = False) -> Union[Dict[str, Any], AsyncGenerator]:
        """Send chat request to Ollama."""
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "format": format,
                "options": options
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

    async def _openai_compatible_chat(self,
                                model: str,
                                messages: List[Dict[str, str]],
                                format: Optional[Dict] = None,
                                options: Optional[Dict] = None,
                                tools: Optional[List[Dict]] = None,
                                stream: bool = False) -> Union[Dict[str, Any], AsyncGenerator]:
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
                #if "num_ctx" in options:
                    #params["max_tokens"] = options["num_ctx"]  # Closest equivalent
                # Handle stop tokens
                if "stop" in options:
                    params["stop"] = options["stop"]

            # Handle format (for JSON responses)
            if format:
                params["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "field_response",
                        "schema": format
                    },
                }

            # Add stream parameter if needed
            if stream:
                params["stream"] = stream

                # For streaming, return an async generator
                async def response_generator():
                    async for chunk in await self._client.chat.completions.create(**params):
                        # Format the response to match Ollama's format
                        if hasattr(chunk, 'choices') and chunk.choices:
                            delta = chunk.choices[0].delta
                            content = delta.content if hasattr(delta, 'content') and delta.content else ""

                            # Check for tool calls in the delta
                            tool_calls = None
                            if hasattr(delta, 'tool_calls') and delta.tool_calls:
                                tool_calls = delta.tool_calls

                            response = {
                                "model": model,
                                "message": {
                                    "role": "assistant",
                                    "content": content
                                }
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
                result = {
                    "model": model,
                    "message": {
                        "role": "assistant",
                        "content": response.choices[0].message.content or "",
                    }
                }

                # Add tool_calls if present
                if hasattr(response.choices[0].message, 'tool_calls') and response.choices[0].message.tool_calls:
                    result["message"]["tool_calls"] = []
                    for tool_call in response.choices[0].message.tool_calls:
                        result["message"]["tool_calls"].append({
                            "id": tool_call.id,
                            "type": tool_call.type,
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments
                            }
                        })

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
        if self.provider_type == LLMProviderType.OLLAMA:
            try:
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                    async with session.get(f"{self.base_url}/api/ps") as response:
                        if response.status == 200:
                            result = await response.json()
                            return result
                        else:
                            error_text = await response.text()
                            logger.error(f"Ollama ps request failed with status {response.status}: {error_text}")
                            return {
                                "models": [],
                                "error": f"Request failed with status {response.status}"
                            }
            except Exception as e:
                logger.error(f"Unexpected error getting Ollama process info: {e}")
                return {
                    "models": [],
                    "error": f"Unexpected error: {str(e)}"
                }
        else:
            # For OpenAI-compatible providers, we can't get "running" models
            # Return a graceful response indicating this feature isn't available
            return {
                "models": [],
                "message": "Model process information not available for OpenAI-compatible providers",
                "provider_type": self.provider_type.value
            }


def get_llm_client():
    """Create and return an LLM client with configuration from config manager."""
    config = config_manager.get_config()
    provider_type = config.get("LLM_PROVIDER", "ollama").lower()
    base_url = config.get("LLM_BASE_URL")
    api_key = config.get("LLM_API_KEY", None)

    return AsyncLLMClient(
        provider_type=provider_type,
        base_url=base_url,
        api_key=api_key
    )
