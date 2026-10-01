"""Prefill warming against llama.cpp's native endpoints.

Warming through the chat endpoint rewrites the prompt tail on every call (it appends an assistant-generation header after the growing user message), so llama.cpp must resume from a checkpoint before the first divergent token (far below the growth point). Instead:

  1. /apply-template renders the prompt exactly as the chat endpoint would.
  2. We strip the trailing generation header (derived per model, see derive_generation_tail) so each warm is a strict prefix of the next warm and of the final extraction call.
  3. /completion with n_predict 0 evaluates it into the KV cache without generating.
"""

import logging

import httpx

logger = logging.getLogger(__name__)


def llama_base_url() -> str:
    """Root URL of the bundled llama-server (native endpoints are not
    mounted under /v1)."""
    from server.utils.allocated_ports import get_llama_port

    return f"http://127.0.0.1:{get_llama_port()}"


async def _post(path: str, payload: dict, timeout: float) -> dict:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(f"{llama_base_url()}{path}", json=payload)
        response.raise_for_status()
        return response.json()


async def render_prompt(messages: list[dict], timeout: float) -> str:
    """Render chat messages through the model's template (no inference)."""
    result = await _post("/apply-template", {"messages": messages}, timeout)
    return str(result.get("prompt", ""))


def common_prefix_len(a: str, b: str) -> int:
    length = 0
    for ca, cb in zip(a, b, strict=False):
        if ca != cb:
            break
        length += 1
    return length


async def derive_generation_tail(system_content: str, timeout: float) -> str | None:
    """Derive the terminator + assistant header the template appends after the final user message, by diffing probe renders of "x" vs "xy" (common prefix ends where the tail begins). The full tail must be stripped or the divergence problem returns one token earlier.

    Returns None if there's no tail; callers degrade.
    """

    probe_a = await render_prompt(
        [
            {"role": "system", "content": system_content},
            {"role": "user", "content": "x"},
        ],
        timeout,
    )
    probe_b = await render_prompt(
        [
            {"role": "system", "content": system_content},
            {"role": "user", "content": "xy"},
        ],
        timeout,
    )
    return probe_a[common_prefix_len(probe_a, probe_b) :] or None


def strip_generation_tail(rendered: str, tail: str) -> str | None:
    """Remove the trailing terminator+header; None on mismatch (degrade)."""
    if not rendered.endswith(tail):
        return None
    return rendered[: -len(tail)]


async def prefill(prompt: str, timeout: float) -> None:
    """Evaluate the prompt into the KV cache without generating anything."""
    await _post(
        "/completion",
        {
            "prompt": prompt,
            "n_predict": 0,
            "cache_prompt": True,
            "temperature": 0.0,
            "stream": False,
        },
        timeout,
    )
