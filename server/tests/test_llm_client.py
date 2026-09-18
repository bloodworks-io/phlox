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
    # Choices without logprobs must not add the key.
    assert "logprobs" not in response


class _FakeLogProbs:
    def __init__(self, payload):
        self._payload = payload

    def model_dump(self):
        return self._payload


@pytest.mark.asyncio
async def test_logprobs_options_map_to_params_and_pass_through():
    # Readout-gate support: options["logprobs"]/["top_logprobs"] must reach
    # the wire params, and the response payload must survive into the dict.
    payload = {
        "content": [
            {
                "token": "NOTE",
                "logprob": -0.05,
                "top_logprobs": [{"token": "NOTE", "logprob": -0.05}],
            }
        ]
    }
    message = SimpleNamespace(content="NOTE", tool_calls=None, reasoning=None)
    completion = SimpleNamespace(
        choices=[SimpleNamespace(message=message, logprobs=_FakeLogProbs(payload))]
    )
    create = AsyncMock(return_value=completion)
    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))

    response = await openai_compatible_chat(
        fake,
        model="test-model",
        messages=[{"role": "user", "content": "hi"}],
        options={"logprobs": True, "top_logprobs": 20, "num_predict": 1},
        stream=False,
    )

    kwargs = fake.chat.completions.create.await_args.kwargs
    assert kwargs["logprobs"] is True
    assert kwargs["top_logprobs"] == 20
    assert kwargs["max_tokens"] == 1
    assert response["logprobs"] == payload
