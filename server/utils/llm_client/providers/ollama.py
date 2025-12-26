"""Ollama provider implementation."""

import logging

import aiohttp

logger = logging.getLogger(__name__)


async def ollama_chat(
    client,
    model: str,
    messages: list,
    format: dict = None,
    options: dict = None,
    tools: list = None,
    stream: bool = False,
) -> dict:
    """Send chat request to Ollama."""
    try:
        kwargs = {
            "model": model,
            "messages": messages,
            "format": format,
            "options": options,
        }

        if tools:
            kwargs["tools"] = tools

        if stream:
            kwargs["stream"] = stream
            return await client.chat(**kwargs)
        else:
            result = await client.chat(**kwargs)
            return result
    except Exception as e:
        logger.error(f"Error in Ollama chat request: {e}")
        raise


async def ollama_ps(base_url: str, timeout: int = 80) -> dict:
    """
    List models that are currently loaded into memory for Ollama.

    Returns:
        Dictionary with models information
    """
    try:
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=timeout)
        ) as session:
            async with session.get(f"{base_url}/api/ps") as response:
                if response.status == 200:
                    result = await response.json()
                    return result
                else:
                    error_text = await response.text()
                    logger.error(
                        f"Ollama ps request failed with status {response.status}: {error_text}"
                    )
                    return {
                        "models": [],
                        "error": f"Request failed with status {response.status}",
                    }
    except Exception as e:
        logger.error(f"Unexpected error getting Ollama process info: {e}")
        return {"models": [], "error": f"Unexpected error: {str(e)}"}
