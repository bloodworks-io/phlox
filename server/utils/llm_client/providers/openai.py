"""OpenAI-compatible provider implementation."""

import logging

logger = logging.getLogger(__name__)


async def openai_compatible_chat(
    client,
    model: str,
    messages: list,
    format: dict = None,
    options: dict = None,
    tools: list = None,
    stream: bool = False,
    extra_body: dict = None,
):
    """
    Send chat request to OpenAI-compatible API using the OpenAI client.

    Returns either a dict (non-streaming) or an async generator (streaming).
    """
    try:
        # Prepare parameters for OpenAI
        params = {
            "model": model,
            "messages": messages,
        }

        if tools:
            params["tools"] = tools
            # Only force tool choice to required if explicitly specified
            if options and options.get("force_tools", False):
                params["tool_choice"] = "required"

        # Map options from our format to OpenAI format
        if options:
            # Direct mappings
            if "temperature" in options:
                params["temperature"] = options["temperature"]
            # Handle stop tokens
            if "stop" in options:
                params["stop"] = options["stop"]

        # Handle format (for JSON responses)
        if format:
            params["response_format"] = (
                {"type": "json_schema", "json_schema": format},
            )

        # Add stream parameter if needed
        if stream:
            # Don't apply extra_body to streaming requests
            pass
            params["stream"] = stream

            # For streaming, return an async generator
            async def response_generator():
                reasoning_started = False
                async for chunk in await client.chat.completions.create(
                    **params
                ):
                    # Format the response to match Ollama's format
                    if hasattr(chunk, "choices") and chunk.choices:
                        delta = chunk.choices[0].delta
                        content = (
                            delta.content
                            if hasattr(delta, "content") and delta.content
                            else ""
                        )

                        # Check for reasoning in the delta (only used for Chat streaming)
                        reasoning = getattr(
                            delta, "reasoning", None
                        ) or getattr(delta, "reasoning_content", None)

                        # Normalize reasoning to </think> tags for consistency
                        if reasoning:
                            if not reasoning_started:
                                # Inject opening think tag
                                yield {
                                    "model": model,
                                    "message": {
                                        "role": "assistant",
                                        "content": "<think>",
                                    },
                                }
                                reasoning_started = True

                            # Stream reasoning content
                            yield {
                                "model": model,
                                "message": {
                                    "role": "assistant",
                                    "content": reasoning,
                                },
                            }
                        elif content:  # Only yield content if not empty
                            # Close think tag if we were streaming reasoning
                            if reasoning_started:
                                yield {
                                    "model": model,
                                    "message": {
                                        "role": "assistant",
                                        "content": "</think>\n\n",
                                    },
                                }
                                reasoning_started = False

                        # Check for tool calls in the delta
                        tool_calls = None
                        if hasattr(delta, "tool_calls") and delta.tool_calls:
                            tool_calls = delta.tool_calls

                        response = {
                            "model": model,
                            "message": {
                                "role": "assistant",
                                "content": content,
                            },
                        }

                        # Add tool_calls if present
                        if tool_calls:
                            response["message"]["tool_calls"] = tool_calls

                        yield response

            return response_generator()
        else:
            # Only apply extra_body to non-streaming requests as it seems to break some endpoints
            if extra_body:
                params.update(extra_body)
            response = await client.chat.completions.create(**params)
            # Convert to Ollama-like format for consistency
            content = response.choices[0].message.content or ""

            result = {
                "model": model,
                "message": {
                    "role": "assistant",
                    "content": content,
                },
            }

            # Add reasoning to result if present
            reasoning = getattr(
                response.choices[0].message, "reasoning", None
            ) or getattr(response.choices[0].message, "reasoning_content", None)

            if reasoning:
                result["message"]["reasoning"] = reasoning

            # Add tool_calls if present
            if (
                hasattr(response.choices[0].message, "tool_calls")
                and response.choices[0].message.tool_calls
            ):
                result["message"]["tool_calls"] = []
                for tool_call in response.choices[0].message.tool_calls:
                    result["message"]["tool_calls"].append(
                        {
                            "id": tool_call.id,
                            "type": tool_call.type,
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments,
                            },
                        }
                    )

            return result
    except Exception as e:
        logger.error(f"Error in OpenAI-compatible chat request: {e}")
        raise
