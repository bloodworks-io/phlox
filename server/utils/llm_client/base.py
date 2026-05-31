"""Base types and enums for LLM client."""

from enum import Enum


class LLMProviderType(Enum):
    OPENAI_COMPATIBLE = "openai"
    LOCAL = "local"
