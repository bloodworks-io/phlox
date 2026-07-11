"""Global storage for dynamically allocated service ports."""

# Default fallback ports
WHISPER_PORT = 8081
LLAMA_PORT = 8082
SERVER_PORT = 5000
EMBEDDING_PORT = 8083


def set_ports(
    server_port: int, llama_port: int, whisper_port: int, embedding_port: int | None = None
) -> None:
    """Update the allocated ports."""
    global SERVER_PORT, LLAMA_PORT, WHISPER_PORT, EMBEDDING_PORT
    SERVER_PORT = server_port
    LLAMA_PORT = llama_port
    WHISPER_PORT = whisper_port
    if embedding_port is not None:
        EMBEDDING_PORT = embedding_port


def get_whisper_port() -> int:
    """Get the Whisper server port."""
    return WHISPER_PORT


def get_llama_port() -> int:
    """Get the Llama server port."""
    return LLAMA_PORT


def get_embedding_port() -> int:
    """Get the Embedding server port."""
    return EMBEDDING_PORT

