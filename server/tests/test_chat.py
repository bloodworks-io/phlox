"""
Tests for the chat endpoint.
Uses TestClient for a synchronous test and mocks out external dependencies.
"""

import json
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.chat import router

app = FastAPI()
# Note: The chat router returns a StreamingResponse.
# For testing we simulate reading the full streamed content.
app.include_router(router, prefix="/api/chat")
client = TestClient(app)


def test_chat_endpoint_streaming():
    with patch("server.api.chat.ChatEngine", autospec=True) as MockChatEngine:
        mock_engine_instance = MockChatEngine.return_value

        async def fake_generate():
            yield "data: " + json.dumps({"chunk": "Part 1"}) + "\n\n"
            yield "data: " + json.dumps({"chunk": "Part 2"}) + "\n\n"

        mock_engine_instance.stream_chat.return_value = fake_generate()

        test_payload = {"messages": [{"role": "user", "content": "What is the capital of France?"}]}
        response = client.post("/api/chat", json=test_payload)

        # Fix: Use response.content instead of response.iter_lines()
        streamed_output = response.content.decode("utf-8")

        assert "Part 1" in streamed_output
        assert "Part 2" in streamed_output
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")


if __name__ == "__main__":
    test_chat_endpoint_streaming()
