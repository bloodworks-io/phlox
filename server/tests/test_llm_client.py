"""Regression tests for the OpenAI-compatible LLM client provider."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from server.llm_client.providers.openai import openai_compatible_chat


def _fake_client(content="NOTE"):
    message = SimpleNamespace(content=content, tool_calls=None, reasoning=None)
    completion = SimpleNamespace(choices=[SimpleNamespace(message=message)])
    create = AsyncMock(return_value=completion)
    return SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create))
    )


@pytest.mark.asyncio
async def test_non_streaming_with_extra_body_returns_dict():
    # Regression: options["extra_body"] made chat() return the streaming
    # generator even with stream=False (live-agent gate/tick breakage).
    fake = _fake_client()
    response = await openai_compatible_chat(
        fake,
        model="test-model",
        messages=[{"role": "user", "content": "hi"}],
        options={"temperature": 0.1, "extra_body": {"reasoning_effort": "none"}},
        stream=False,
    )
    assert isinstance(response, dict)
    assert response["message"]["content"] == "NOTE"
    kwargs = fake.chat.completions.create.await_args.kwargs
    assert kwargs["reasoning_effort"] == "none"
    assert "stream" not in kwargs
