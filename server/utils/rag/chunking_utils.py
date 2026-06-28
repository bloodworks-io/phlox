from abc import ABC, abstractmethod
from enum import StrEnum

import tiktoken


class BaseChunker(ABC):
    @abstractmethod
    def split_text(self, text: str) -> list[str]:
        pass


# Count the number of tokens in each page_content
def openai_token_count(string: str) -> int:
    """Returns the number of tokens in a text string.
    Falls back to character count if tiktoken is unavailable.
    """
    try:
        encoding = tiktoken.get_encoding("cl100k_base")
        num_tokens = len(encoding.encode(string, disallowed_special=()))
        return num_tokens
    except (ImportError, ValueError):
        # Fallback to character count if tiktoken unavailable
        # Use a rough approximation: 1 token ~ 4 characters
        return len(string) // 4


class Language(StrEnum):
    """Enum of the programming languages."""

    CPP = "cpp"
    GO = "go"
    JAVA = "java"
    KOTLIN = "kotlin"
    JS = "js"
    TS = "ts"
    PHP = "php"
    PROTO = "proto"
    PYTHON = "python"
    RST = "rst"
    RUBY = "ruby"
    RUST = "rust"
    SCALA = "scala"
    SWIFT = "swift"
    MARKDOWN = "markdown"
    LATEX = "latex"
    HTML = "html"
    SOL = "sol"
    CSHARP = "csharp"
    COBOL = "cobol"
    C = "c"
    LUA = "lua"
    PERL = "perl"
