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
from server.utils.chat.tools import get_tools_definition
from server.utils.chat.tools.direct_response import (
    execute as execute_direct_response,
)
from server.utils.chat.tools.literature_search import (
    execute as execute_literature_search,
)
from server.utils.chat.tools.transcript_search import (
    execute as execute_transcript_search,
)
from server.utils.helpers import clean_think_tags
from server.utils.llm_client.base import LLMProviderType
from server.utils.llm_client.client import get_llm_client
from server.utils.rag.chroma import ChromaManager

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

        # Build system messages
        self.CHAT_SYSTEM_MESSAGE = build_system_messages()

        # Get the unified LLM client
        self.llm_client = get_llm_client()

        # Initialize ChromaManager (replaces LiteratureService)
        self.chroma_manager = ChromaManager()

        self.last_successful_collection = "misc"

    async def get_streaming_response(
        self, conversation_history: list, raw_transcription=None
    ):
        """
        Generate a streaming response based on the conversation history and relevant literature.
        """
        prompts = config_manager.get_prompts_and_options()
        collection_names = self.chroma_manager.list_collections()

        context_question_options = prompts["options"]["general"]
        context_question_options.pop("stop", None)
        print(context_question_options)

        # Clean </think> tags from conversation history
        cleaned_conversation_history = clean_think_tags(conversation_history)

        message_list = self.CHAT_SYSTEM_MESSAGE + cleaned_conversation_history

        # First call to determine if we need literature or direct response
        self.logger.info("Initial LLM call to determine tool usage...")

        # Get tool definitions
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
            yield status_message(
                "Error processing request. Generating direct response..."
            )

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

        Args:
            tool_call: The tool call to execute
            message_list: The current message list
            conversation_history: The conversation history
            raw_transcription: The raw transcription
            context_question_options: The context question options

        Yields:
            Dict: Streaming response chunks
        """
        function_name = tool_call["function"]["name"]

        self.logger.info(f"LLM chose tool: {function_name}")

        if function_name == "direct_response":
            async for result in execute_direct_response(
                tool_call=tool_call,
                llm_client=self.llm_client,
                config=self.config,
                message_list=message_list,
                context_question_options=context_question_options,
            ):
                yield result

        elif function_name == "transcript_search":
            async for result in execute_transcript_search(
                tool_call=tool_call,
                llm_client=self.llm_client,
                config=self.config,
                message_list=message_list,
                conversation_history=conversation_history,
                raw_transcription=raw_transcription,
                context_question_options=context_question_options,
            ):
                yield result

        else:  # get_relevant_literature
            async for result in execute_literature_search(
                tool_call=tool_call,
                llm_client=self.llm_client,
                config=self.config,
                chroma_manager=self.chroma_manager,
                message_list=message_list,
                context_question_options=context_question_options,
            ):
                yield result

    async def stream_chat(
        self, conversation_history: list, raw_transcription=None
    ):
        """Stream chat response from the LLM"""
        try:
            self.logger.info("Starting LLM stream...")
            yield start_message()

            async for chunk in self.get_streaming_response(
                conversation_history, raw_transcription
            ):
                yield chunk

        except Exception as e:
            self.logger.error(f"Error in stream_chat: {e}")
            raise


# Usage
if __name__ == "__main__":
    chat_engine = ChatEngine()
    conversation_history = [
        {"role": "user", "content": "What are the symptoms of diabetes?"}
    ]
    response = chat_engine.chat(conversation_history)
    print(response)
