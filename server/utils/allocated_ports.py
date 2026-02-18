"""Global storage for dynamically allocated service ports."""

# Default fallback ports
WHISPER_PORT = 8081
LLAMA_PORT = 8082
SERVER_PORT = 5000


def set_ports(server_port: int, llama_port: int, whisper_port: int) -> None:
    """Update the allocated ports."""
    global SERVER_PORT, LLAMA_PORT, WHISPER_PORT
    SERVER_PORT = server_port
    LLAMA_PORT = llama_port
    WHISPER_PORT = whisper_port


def get_whisper_port() -> int:
    """Get the Whisper server port."""
    return WHISPER_PORT


def get_llama_port() -> int:
    """Get the Llama server port."""
    return LLAMA_PORT


def get_server_port() -> int:
    """Get the server port."""
    return SERVER_PORT
