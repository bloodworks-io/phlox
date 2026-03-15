"""
LLM Client Package

A unified client interface for OpenAI-compatible and local providers.

Public API:
- get_llm_client(): Factory function to create a configured LLM client
- AsyncLLMClient: Main unified client class
- LLMProviderType: Enum for provider types
- LocalModelManager: Model lifecycle management
"""

from .base import LLMProviderType
from .client import AsyncLLMClient, get_llm_client
from .manager import LocalModelManager
from .utils import repair_json

__all__ = [
    "get_llm_client",
    "repair_json",
    "AsyncLLMClient",
    "LLMProviderType",
    "LocalModelManager",
]
