import aiohttp
import json
import logging
import os
import platform
from pathlib import Path
import asyncio
from typing import Dict, List, Any, Optional, Union, AsyncGenerator
from server.database.config import config_manager
from server.constants import DATA_DIR, IS_DOCKER
from enum import Enum

logger = logging.getLogger(__name__)

class LLMProviderType(Enum):
    OLLAMA = "ollama"
    OPENAI_COMPATIBLE = "openai"
    LOCAL = "local"

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

def is_arm_mac() -> bool:
    """Check if we're running on an ARM Mac."""
    return platform.system() == "Darwin" and platform.machine() == "arm64"

class LocalModelManager:
    """Manages local model downloads and caching."""

    def __init__(self, models_dir: Optional[str] = None):
        if models_dir:
            self.models_dir = models_dir
        else:
            # Use the app's data directory for consistency
            self.models_dir = DATA_DIR / "models"

        # Ensure it's a Path object and create the directory
        self.models_dir = Path(self.models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)

    def get_model_path(self, repo_id: str, filename: str) -> str:
        """Get the local path for a model file."""
        # Sanitize repo_id for filesystem
        safe_repo_id = repo_id.replace("/", "_")
        model_path = self.models_dir / safe_repo_id / filename
        return str(model_path)

    def is_model_downloaded(self, repo_id: str, filename: str) -> bool:
        """Check if a model is already downloaded."""
        model_path = Path(self.get_model_path(repo_id, filename))
        return model_path.exists()

    async def download_model(self, repo_id: str, filename: str, progress_callback=None) -> str:
        """Download a model from Hugging Face Hub."""
        try:
            from huggingface_hub import hf_hub_download

            model_path = Path(self.get_model_path(repo_id, filename))
            model_path.parent.mkdir(parents=True, exist_ok=True)

            # Download the model
            downloaded_path = hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                cache_dir=str(self.models_dir),
                local_dir=str(model_path.parent),
                local_dir_use_symlinks=False
            )

            logger.info(f"Downloaded model {repo_id}/{filename} to {downloaded_path}")
            return downloaded_path

        except ImportError:
            raise ImportError("huggingface_hub not installed. Install with 'pip install huggingface_hub'")
        except Exception as e:
            logger.error(f"Error downloading model {repo_id}/{filename}: {e}")
            raise

class LocalLLMClient:
    """Local LLM inference client using llama-cpp-python."""

    def __init__(self, models_dir: Optional[str] = None, **kwargs):
        if IS_DOCKER:
            raise RuntimeError("Local inference is only available in Tauri builds")

        self.model_manager = LocalModelManager(models_dir)
        self._llm = None
        self._current_model = None
        self.kwargs = kwargs

        self._set_default_params()

    def _set_default_params(self):
        """Set optimal default parameters based on platform."""
        if is_arm_mac():
            # Optimize for Apple Silicon with Metal
            self.kwargs.setdefault("n_gpu_layers", -1)  # Use Metal
            self.kwargs.setdefault("n_ctx", 4096)
            self.kwargs.setdefault("verbose", False)
        else:
            # Default CPU settings
            self.kwargs.setdefault("n_ctx", 2048)
            self.kwargs.setdefault("verbose", False)

    async def load_model(self, model_path_or_repo: str, filename: Optional[str] = None) -> None:
        """Load a model for inference."""
        try:
            from llama_cpp import Llama
        except ImportError:
            raise ImportError("llama-cpp-python not installed. Install with appropriate backend support.")

        # Determine if this is a local path or HF repo
        if filename is not None:
            # This is a HF repo download
            if not self.model_manager.is_model_downloaded(model_path_or_repo, filename):
                logger.info(f"Downloading model {model_path_or_repo}/{filename}...")
                model_path = await self.model_manager.download_model(model_path_or_repo, filename)
            else:
                model_path = self.model_manager.get_model_path(model_path_or_repo, filename)
        else:
            # This is a local path
            model_path = model_path_or_repo

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")

        # Load the model in executor to avoid blocking
        logger.info(f"Loading model from {model_path}")
        self._llm = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: Llama(model_path=model_path, **self.kwargs)
        )
        self._current_model = model_path_or_repo
        logger.info(f"Model loaded successfully: {self._current_model}")

    async def chat(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        """Generate a chat completion using create_chat_completion."""
        if self._llm is None:
            raise RuntimeError("No model loaded. Call load_model() first.")

        # Format messages
        formatted_messages = self._format_messages_for_chat(messages)

        # Prepare chat completion parameters
        chat_params = {
            "messages": formatted_messages,
            "max_tokens": kwargs.get("max_tokens", 512),
            "temperature": kwargs.get("temperature", 0.7),
            "top_p": kwargs.get("top_p", 0.9),
            "stop": kwargs.get("stop", None),
        }

        # Generate response using chat completion
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._llm.create_chat_completion(**chat_params)
        )

        # Format response to match expected structure
        return {
            "model": self._current_model,
            "message": {
                "role": "assistant",
                "content": response["choices"][0]["message"]["content"]
            }
        }

    async def chat_with_structured_output(self, messages: List[Dict[str, str]], schema: Dict, **kwargs) -> str:
        """Generate structured output using JSON schema mode."""
        if self._llm is None:
            raise RuntimeError("No model loaded. Call load_model() first.")

        # Handle thinking models
        if is_thinking_model(self._current_model):
            schema = add_thinking_to_schema(schema, self._current_model)

        # Prepare parameters for structured output
        chat_params = {
            "messages": messages,
            "response_format": {
                "type": "json_object",
                "schema": schema
            },
            "max_tokens": kwargs.get("max_tokens", 1024),
            "temperature": kwargs.get("temperature", 0.1),  # Lower temp for structured output
        }

        # Generate structured response
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._llm.create_chat_completion(**chat_params)
        )

        return response["choices"][0]["message"]["content"]

    async def stream_chat(self, messages: List[Dict[str, str]], **kwargs) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream chat completion responses."""
        if self._llm is None:
            raise RuntimeError("No model loaded. Call load_model() first.")

        chat_params = {
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 512),
            "temperature": kwargs.get("temperature", 0.7),
            "stream": True,
        }

        # Create the streaming response in executor
        stream = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._llm.create_chat_completion(**chat_params)
        )

        # Yield chunks as they come
        for chunk in stream:
            if chunk["choices"][0]["delta"].get("content"):
                yield {
                    "model": self._current_model,
                    "message": {
                        "role": "assistant",
                        "content": chunk["choices"][0]["delta"]["content"]
                    }
                }

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the currently loaded model."""
        if self._llm is None:
            return {"loaded": False}

        return {
            "loaded": True,
            "model": self._current_model,
            "context_size": self._llm.n_ctx(),
            "vocab_size": self._llm.n_vocab(),
        }

class AsyncLLMClient:
    """A unified client interface for LLM providers (Ollama, OpenAI-compatible, Local)."""

    def __init__(self,
            provider_type: Union[str, LLMProviderType],
            base_url: Optional[str] = None,
            api_key: Optional[str] = None,
            timeout: int = 120,
            **local_kwargs):
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
                raise ValueError(f"Invalid provider type: {provider_type}. Must be 'ollama', 'openai_compatible', or 'local'")
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
                raise ImportError("Ollama client not installed. Install with 'pip install ollama'")
        else:
            # For OpenAI-compatible
            if not base_url:
                raise ValueError("base_url is required for OpenAI-compatible provider")
            try:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(
                    api_key=self.api_key,
                    base_url=f"{self.base_url}/v1",
                    timeout=timeout
                )
            except ImportError:
                raise ImportError("OpenAI client not installed. Install with 'pip install openai'")

    async def load_local_model(self, model_path_or_repo: str, filename: Optional[str] = None) -> None:
        """Load a local model (only works with LOCAL provider)."""
        if self.provider_type != LLMProviderType.LOCAL:
            raise RuntimeError("load_local_model only works with LOCAL provider")

        await self._client.load_model(model_path_or_repo, filename)

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
        if self.provider_type == LLMProviderType.LOCAL:
            return await self._client.chat_with_structured_output(messages, schema, **(options or {}))

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
        if self.provider_type == LLMProviderType.LOCAL:
            if stream:
                return self._client.stream_chat(messages, **(options or {}))
            else:
                return await self._client.chat(messages, **(options or {}))
        elif self.provider_type == LLMProviderType.OLLAMA:
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

        if self.provider_type == LLMProviderType.LOCAL:
            models = []
            if hasattr(self._client, '_current_model') and self._client._current_model:
                models.append({
                    "name": self._client._current_model,
                    "model": self._client._current_model,
                    "size": 0,  # Size info not readily available
                    "digest": "",
                    "details": {
                        "format": "gguf",
                        "family": "llama",
                        "families": ["llama"],
                        "parameter_size": "unknown",
                        "quantization_level": "unknown"
                    }
                })

        elif self.provider_type == LLMProviderType.OLLAMA:
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

    if provider_type == "local":
        # For local provider, base_url and api_key are not needed
        return AsyncLLMClient(
            provider_type=provider_type,
            models_dir=config.get("LOCAL_MODELS_DIR")  # Optional custom models directory
        )
    else:
        return AsyncLLMClient(
            provider_type=provider_type,
            base_url=base_url,
            api_key=api_key
        )
