"""
ChatEngine - Main orchestrator for chat interactions.

This module provides the ChatEngine class which coordinates between
the LLM client, ChromaManager, and tool execution.
"""

import logging

from server.database.config.manager import config_manager
from server.utils.chat.config.prompts import build_system_messages
from server.utils.chat.streaming.response import (
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
            response = await self.llm_client.chat(
                model=self.config["PRIMARY_MODEL"],
                messages=message_list,
                options=context_question_options,
                tools=tools,
            )

            function_response = None
            tool_calls = None

            # Check for tool calls in the response
            if (
                self.config.get("LLM_PROVIDER", "ollama").lower()
                == LLMProviderType.OPENAI_COMPATIBLE.value
            ):
                # For OpenAI compatible, check message.tool_calls
                tool_calls = response["message"].get("tool_calls")
            else:
                # For Ollama, check tool_calls in the response directly
                tool_calls = response.get("tool_calls")

            if not tool_calls:
                self.logger.info("LLM chose direct response.")
                yield status_message("Generating response...")
                # Stream direct response
                async for chunk in stream_llm_response(
                    llm_client=self.llm_client,
                    model=self.config["PRIMARY_MODEL"],
                    messages=message_list,
                    options=context_question_options,
                ):
                    yield chunk
            else:
                # Add the tool call to the message list
                message_list.append(response["message"])

                # Execute the tool call
                function_response = None
                async for result in self._execute_tool_call(
                    tool_call=tool_calls[0],
                    message_list=message_list,
                    conversation_history=conversation_history,
                    raw_transcription=raw_transcription,
                    context_question_options=context_question_options,
                ):
                    if result.get("type") == "end":
                        function_response = result.get("function_response")
                    elif result.get("type") != "end":
                        yield result

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
