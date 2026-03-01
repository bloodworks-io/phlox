"""Request token storage for API authentication."""

_REQUEST_TOKEN: str | None = None


def get_request_token() -> str | None:
    """Get the current request token for API authentication."""
    return _REQUEST_TOKEN


def set_request_token(token: str) -> None:
    """Set the request token."""
    global _REQUEST_TOKEN
    _REQUEST_TOKEN = token
