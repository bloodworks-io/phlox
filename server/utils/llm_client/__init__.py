"""
LLM Client Package

A unified client interface for OpenAI-compatible and local providers.

Public API:
- get_llm_client(): Factory function to create a configured LLM client
- AsyncLLMClient: Main unified client class
- repair_json: JSON repair utility
"""

from .client import AsyncLLMClient, get_llm_client
from .utils import repair_json

__all__ = [
    "get_llm_client",
    "repair_json",
    "AsyncLLMClient",
]
