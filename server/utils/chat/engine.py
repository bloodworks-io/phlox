"""
ChatEngine - Main orchestrator for chat interactions.

This module provides the ChatEngine class which coordinates between
the LLM client, ChromaManager, and tool execution.
"""

import json
import logging

from server.database.config.manager import config_manager
from server.utils.chat.config.prompts import build_system_messages
from server.utils.chat.streaming.response import (
    chunk_message,
    end_message,
    start_message,
    status_message,
    stream_llm_response,
)
from server.utils.chat.tools import execute_tool_streaming, get_tools_definition
from server.utils.helpers import clean_think_tags
from server.utils.llm_client.base import LLMProviderType
from server.utils.llm_client.client import get_llm_client
from server.utils.rag.chroma import CHROMADB_AVAILABLE, ChromaManager

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class ChatEngine:
    """
    A class to manage chat interactions, including retrieving relevant medical literature
    and generating responses using an AI model.
    """

    def __init__(self):
        """
        Initialize the ChatEngine with necessary configurations, clients, and models.
        """
        self.config = config_manager.get_config()
        self.prompts = config_manager.get_prompts_and_options()

        # Configure logging for the chat class
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)

        # Get the unified LLM client
        self.llm_client = get_llm_client()

        # Initialize ChromaManager if RAG dependencies are available
        if CHROMADB_AVAILABLE:
            self.chroma_manager = ChromaManager()
        else:
            self.chroma_manager = None
            self.logger.warning("RAG dependencies not available. Literature search disabled.")

        self.last_successful_collection = "misc"

    async def get_streaming_response(
        self,
        conversation_history: list,
        raw_transcription=None,
        patient_context: dict | None = None,
    ):
        """
        Generate a streaming response based on the conversation history and relevant literature.

        Args:
            conversation_history: List of conversation messages
            raw_transcription: Optional raw transcription
            patient_context: Optional patient context dict containing name, dob, ur_number,
                           encounter_date, template_data, and template_fields
        """
        prompts = config_manager.get_prompts_and_options()
        collection_names = (
            self.chroma_manager.list_collections() if self.chroma_manager is not None else []
        )

        context_question_options = prompts["options"]["general"]
        context_question_options.pop("stop", None)

        # Clean</think> tags from conversation history
        cleaned_conversation_history = clean_think_tags(conversation_history)

        # Filter out any system messages from conversation history to ensure
        # only the backend's system messages are used (prevents duplicates and
        # ensures system messages are only at the beginning)
        filtered_history = [m for m in cleaned_conversation_history if m.get("role") != "system"]

        # Build system messages with patient context
        template_fields = patient_context.get("template_fields") if patient_context else None
        message_list = build_system_messages(patient_context, template_fields) + filtered_history

        self.logger.info(f"Message list: {message_list}")

        # First call to determine if we need literature or direct response
        self.logger.info("Initial LLM call to determine tool usage...")

        # Get tool definitions (always includes built-in tools)
        tools = get_tools_definition(collection_names)

        try:
            MAX_ITERATIONS = 5
            iterations = 0
            function_response = None
            generated_final_answer = False

            while iterations < MAX_ITERATIONS:
                iterations += 1
                self.logger.info(f"Tool execution loop iteration {iterations}")

                stream = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=message_list,
                    options=context_question_options,
                    tools=tools,
                    stream=True,
                )

                # Accumulators for the streaming response
                accumulated_content = ""
                accumulated_output = ""
                thinking_open = False
                accumulated_tool_calls = {}

                async for chunk in stream:
                    if "message" in chunk:
                        msg = chunk["message"]

                        # Handle reasoning first and stream it inside explicit <think> tags
                        reasoning_piece = (
                            msg.get("reasoning")
                            or msg.get("reasoning_content")
                            or msg.get("thinking")
                        )
                        if reasoning_piece:
                            if not thinking_open:
                                opening_tag = "<think>\n"
                                accumulated_output += opening_tag
                                yield chunk_message(opening_tag)
                                thinking_open = True

                            accumulated_output += reasoning_piece
                            yield chunk_message(reasoning_piece)

                        # Handle content; close think block before normal content starts
                        if "content" in msg and msg["content"]:
                            if thinking_open:
                                closing_tag = "\n</think>\n"
                                accumulated_output += closing_tag
                                yield chunk_message(closing_tag)
                                thinking_open = False

                            content_piece = msg["content"]
                            accumulated_content += content_piece
                            accumulated_output += content_piece
                            yield chunk_message(content_piece)

                        # Handle tool calls
                        if "tool_calls" in msg and msg["tool_calls"]:
                            for tc in msg["tool_calls"]:
                                # OpenAI yields ChoiceDeltaToolCall objects with an index
                                if hasattr(tc, "index"):
                                    idx = tc.index
                                    if idx not in accumulated_tool_calls:
                                        accumulated_tool_calls[idx] = {
                                            "id": getattr(tc, "id", ""),
                                            "type": getattr(tc, "type", "function"),
                                            "function": {"name": "", "arguments": ""}
                                        }
                                    if hasattr(tc, "function") and tc.function:
                                        if hasattr(tc.function, "name") and tc.function.name:
                                            accumulated_tool_calls[idx]["function"]["name"] += tc.function.name
                                        if hasattr(tc.function, "arguments") and tc.function.arguments:
                                            accumulated_tool_calls[idx]["function"]["arguments"] += tc.function.arguments
                                # Ollama might yield dictionaries
                                elif isinstance(tc, dict):
                                    # Ollama usually yields the full tool call at the end of the stream
                                    idx = len(accumulated_tool_calls)
                                    accumulated_tool_calls[idx] = tc

                # If the stream ended while still in thinking mode, close the <think> block
                if thinking_open:
                    closing_tag = "\n</think>\n"
                    accumulated_output += closing_tag
                    yield chunk_message(closing_tag)
                    thinking_open = False

                # Flatten tool calls into a list
                final_tool_calls = [v for k, v in sorted(accumulated_tool_calls.items())]

                # Format the assistant message for history
                assistant_message = {"role": "assistant"}
                assistant_message["content"] = accumulated_output or accumulated_content

                if final_tool_calls:
                    assistant_message["tool_calls"] = final_tool_calls

                # Add the assistant's message (which includes reasoning and/or tool calls) to history
                message_list.append(assistant_message)

                if not final_tool_calls:
                    # The LLM generated text without calling a tool.
                    self.logger.info("LLM generated final response without tool calls. Breaking loop.")
                    generated_final_answer = True
                    break
                else:
                    # Check if the tool is direct_response
                    if final_tool_calls[0]["function"]["name"] == "direct_response":
                        self.logger.info("LLM called direct_response tool. Breaking loop and streaming fallback.")
                        message_list.pop()
                        yield status_message("Generating response...")
                        async for chunk in stream_llm_response(
                            llm_client=self.llm_client,
                            model=self.config["PRIMARY_MODEL"],
                            messages=message_list,
                            options=context_question_options,
                        ):
                            yield chunk
                        generated_final_answer = True
                        break

                    # Execute the tool call and emit an explicit status event to the UI
                    tool_call = final_tool_calls[0]
                    tool_name = tool_call["function"]["name"]

                    # Include key args (like query) so the UI can show what is being executed
                    tool_args_raw = tool_call.get("function", {}).get("arguments", "") or ""
                    tool_query = ""

                    try:
                        parsed_args = {}
                        if isinstance(tool_args_raw, str) and tool_args_raw.strip():
                            parsed_args = json.loads(tool_args_raw)
                        elif isinstance(tool_args_raw, dict):
                            parsed_args = tool_args_raw

                        if isinstance(parsed_args, dict):
                            for key in ("query", "search_query", "topic", "question", "disease"):
                                value = parsed_args.get(key)
                                if isinstance(value, str) and value.strip():
                                    tool_query = value.strip()
                                    break
                    except Exception:
                        # If arguments are malformed, still emit a useful status without query details
                        tool_query = ""

                    if tool_query:
                        # Keep status concise for UI rendering
                        tool_query = tool_query[:200]
                        yield status_message(f"Calling tool: {tool_name} | query: {tool_query}")
                    else:
                        yield status_message(f"Calling tool: {tool_name}")

                    async for result in self._execute_tool_call(
                        tool_call=tool_call,
                        message_list=message_list,
                        conversation_history=conversation_history,
                        raw_transcription=raw_transcription,
                        context_question_options=context_question_options,
                    ):
                        if result.get("type") == "end":
                            function_response = result.get("function_response")
                            # We MUST append the tool's response to the message_list to continue the loop
                            if function_response and "content" in function_response:
                                from server.utils.chat.streaming.response import tool_response_message
                                message_list.append(tool_response_message(
                                    tool_call_id=final_tool_calls[0].get("id", ""),
                                    content=function_response["content"]
                                ))
                        elif result.get("type") != "end":
                            yield result

            # If we hit MAX_ITERATIONS without a final non-tool answer, force one final pass.
            if not generated_final_answer and iterations >= MAX_ITERATIONS:
                self.logger.warning(
                    "Reached max tool iterations without final answer. "
                    "Forcing final non-tool response."
                )
                yield status_message("Finalizing response...")
                async for chunk in stream_llm_response(
                    llm_client=self.llm_client,
                    model=self.config["PRIMARY_MODEL"],
                    messages=message_list,
                    options=context_question_options,
                ):
                    yield chunk

        except Exception as e:
            self.logger.error(f"Error processing tool call: {str(e)}")
            yield status_message("Error processing request. Generating direct response...")

            # Fallback to direct response in case of error
            async for chunk in stream_llm_response(
                llm_client=self.llm_client,
                model=self.config["PRIMARY_MODEL"],
                messages=message_list,
                options=context_question_options,
            ):
                yield chunk

        # Signal end of stream with function_response if available
        self.logger.info("Streaming chat completed.")
        yield end_message(function_response=function_response)

    async def _execute_tool_call(
        self,
        tool_call: dict,
        message_list: list,
        conversation_history: list,
        raw_transcription: str,
        context_question_options: dict,
    ):
        """
        Execute a tool call and yield streaming responses.

        Uses the central tool executor for unified tool dispatch.

        Args:
            tool_call: The tool call to execute
            message_list: The current message list
            conversation_history: The conversation history
            raw_transcription: The raw transcription
            context_question_options: The context question options

        Yields:
            Dict: Streaming response chunks
        """
        self.logger.info(f"Executing tool via central executor: {tool_call['function']['name']}")

        async for result in execute_tool_streaming(
            tool_call=tool_call,
            llm_client=self.llm_client,
            config=self.config,
            message_list=message_list,
            context_question_options=context_question_options,
            chroma_manager=self.chroma_manager,
            conversation_history=conversation_history,
            raw_transcription=raw_transcription,
        ):
            yield result

    async def stream_chat(
        self,
        conversation_history: list,
        raw_transcription=None,
        patient_context: dict | None = None,
    ):
        """Stream chat response from the LLM

        Args:
            conversation_history: List of conversation messages
            raw_transcription: Optional raw transcription
            patient_context: Optional patient context dict
        """
        try:
            self.logger.info("Starting LLM stream...")
            yield start_message()

            async for chunk in self.get_streaming_response(
                conversation_history, raw_transcription, patient_context
            ):
                yield chunk

        except Exception as e:
            self.logger.error(f"Error in stream_chat: {e}")
            raise


# Usage
if __name__ == "__main__":
    chat_engine = ChatEngine()
    conversation_history = [{"role": "user", "content": "What are the symptoms of diabetes?"}]
    response = chat_engine.chat(conversation_history)
    print(response)
