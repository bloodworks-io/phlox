import tiktoken


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
