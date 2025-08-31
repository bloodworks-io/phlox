"""
Chat tools definitions and execution logic for the Phlox application.

This module contains the tool definitions and execution logic used by the ChatEngine
to determine which actions to take based on user input.
"""

import json
import logging
from typing import List, Dict, Any, AsyncGenerator

from server.utils.helpers import clean_think_tags

logger = logging.getLogger(__name__)

def get_tools_definition(collection_names: List[str]) -> List[Dict[str, Any]]:
    """
    Get the tools definition based on available collections.

    Args:
        collection_names (list): List of available collection names

    Returns:
        list: List of tool definitions
    """
    collection_names_string = ", ".join(collection_names)
    return [
        {
            "type": "function",
            "function": {
                "name": "transcript_search",
                "description": "Use this tool if the user asks about something from the transcript, interview, or conversation with the patient. This will search the transcript for relevant information.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_relevant_literature",
                "description": f"Only use this tool if answering the most recent message from the user would benefit from a literature search. Available disease areas: {collection_names_string}, other",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "disease_name": {
                            "type": "string",
                            "description": f"The disease that this question is referring to (must be one of: {collection_names_string}, other)",
                        },
                        "question": {
                            "type": "string",
                            "description": "The question to be answered. Try and be specific and succinct.",
                        },
                    },
                    "required": ["disease_name", "question"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "direct_response",
                "description": "Use this tool if the most recent question from the user is a non-medical query (greetings, chat, clarifications).",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
    ]


async def execute_tool_call(
    tool_call: Dict[str, Any],
    chat_engine: Any,
    message_list: List[Dict[str, str]],
    conversation_history: List[Dict[str, str]],
    raw_transcription: str,
    context_question_options: Dict[str, Any]
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Execute a tool call and yield streaming responses.

    Args:
        tool_call: The tool call to execute
        chat_engine: The ChatEngine instance
        message_list: The current message list
        conversation_history: The conversation history
        raw_transcription: The raw transcription
        context_question_options: The context question options

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    function_name = tool_call["function"]["name"]
    function_arguments = None

    if "arguments" in tool_call["function"]:
        # Parse function arguments from JSON string if needed
        try:
            if isinstance(tool_call["function"]["arguments"], str):
                function_arguments = json.loads(
                    tool_call["function"]["arguments"]
                )
            else:
                function_arguments = tool_call["function"]["arguments"]
        except json.JSONDecodeError:
            logger.error("Failed to parse function arguments JSON")
            function_arguments = {}

    logger.info(f"LLM chose tool: {function_name}")

    if function_name == "direct_response":
        logger.info("Executing direct response...")
        yield {
            "type": "status",
            "content": "Generating response...",
        }

        # For direct response, we don't need to add tool results, just stream response
        async for chunk in await chat_engine.llm_client.chat(
            model=chat_engine.config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
            stream=True,
        ):
            if "message" in chunk and "content" in chunk["message"]:
                yield {
                    "type": "chunk",
                    "content": chunk["message"]["content"],
                }

    elif function_name == "transcript_search":
        logger.info("Executing query_transcript tool...")
        # Check if transcript is available
        if not raw_transcription:
            logger.info("No transcript available.")
            yield {
                "type": "status",
                "content": "Generating response...",
            }
            # No transcript available, inform the user
            message_list.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id", ""),
                    "content": "No transcript is available to query. Please answer the user's question without transcript information.",
                }
            )

            async for chunk in await chat_engine.llm_client.chat(
                model=chat_engine.config["PRIMARY_MODEL"],
                messages=message_list,
                options=context_question_options,
                stream=True,
            ):
                if (
                    "message" in chunk
                    and "content" in chunk["message"]
                ):
                    yield {
                        "type": "chunk",
                        "content": chunk["message"]["content"],
                    }
        else:
            logger.info("Searching transcript for query...")
            yield {
                "type": "status",
                "content": "Searching through transcript...",
            }

            # Create a query to extract information from the transcript
            query = conversation_history[-1]["content"]

            # Create a new message list with the transcript and query
            transcript_query_messages = [
                {
                    "role": "system",
                    "content": "You are a helpful medical assistant. Extract the relevant information from the provided transcript to answer the user's question. Only include information that is present in the transcript and include direct quotes. The transcript was generated by an automated system therefore it may contain errors.",
                },
                {
                    "role": "user",
                    "content": f"Here is the transcript of a patient conversation:\n\n{raw_transcription}\n\nBased on this transcript only, please answer the following question: {query}",
                },
            ]

            # Get information from transcript
            transcript_response = await chat_engine.llm_client.chat(
                model=chat_engine.config["PRIMARY_MODEL"],
                messages=transcript_query_messages,
                options=context_question_options,
            )

            transcript_info = transcript_response.get("message", {}).get("content", "")

            # Clean think tags
            cleaned_transcript_info = ""
            cleaned_result = clean_think_tags([{"content": transcript_info}])
            if cleaned_result and len(cleaned_result) > 0 and isinstance(cleaned_result[0], dict) and "content" in cleaned_result[0]:
                cleaned_transcript_info = str(cleaned_result[0].get("content", ""))

            logger.info(
                f"Transcript query result: {cleaned_transcript_info[:200]}..."
            )

            # Add transcript info to original conversation as a tool response
            message_list.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id", ""),
                    "content": f"The following information was found in the transcript:\n\n{cleaned_transcript_info}",
                }
            )
            # Clean think tags again
            cleaned_message_list = clean_think_tags(message_list)

            logger.info(
                f"Transcript query messagelist: {cleaned_message_list}"
            )
            # Send generating response status
            yield {
                "type": "status",
                "content": "Generating response with transcript information...",
            }

            logger.info(
                "Starting response stream to frontend"
            )

            # Stream the answer
            async for chunk in await chat_engine.llm_client.chat(
                model=chat_engine.config["PRIMARY_MODEL"],
                messages=cleaned_message_list,
                options=context_question_options,
                stream=True,
            ):
                if (
                    "message" in chunk
                    and "content" in chunk["message"]
                ):
                    yield {
                        "type": "chunk",
                        "content": chunk["message"]["content"],
                    }

    else:  # get_relevant_literature is a method in the ChatEngine class
        logger.info(
            "Executing get_relevant_literature tool..."
        )
        # Send RAG status message
        yield {
            "type": "status",
            "content": "Searching medical literature...",
        }

        # Get disease_name and question from function arguments
        disease_name = ""
        question = ""
        if function_arguments:
            disease_name = function_arguments.get("disease_name", "")
            question = function_arguments.get("question", "")

        function_response_list = chat_engine.get_relevant_literature(
            disease_name,
            question,
        )

        if (
            function_response_list
            == "No relevant literature available"
        ):
            logger.info(
                "No relevant literature found in database."
            )
            # Add the tool response to the message list
            message_list.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id", ""),
                    "content": "No relevant literature available in the database. Answer the user's question but inform them that you were unable to find any relevant information.",
                }
            )
            function_response = None
        else:
            logger.info(
                f"Retrieved relevant literature for disease: {disease_name}"
            )
            if isinstance(function_response_list, list):
                function_response_string = "\n".join(
                    function_response_list
                )
            else:
                function_response_string = str(function_response_list)

            # Add the tool response to the message list
            message_list.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id", "") if tool_call else "",
                    "content": f"The below text excerpts are taken from relevant sections of the guidelines; these may help you answer the user's question. The user has not sent you these documents, they have come from your own database.\n\n{function_response_string}",
                }
            )

            function_response = function_response_list

        # Send generating response status
        yield {
            "type": "status",
            "content": "Generating response with retrieved information...",
        }

        # Stream the context answer
        async for chunk in await chat_engine.llm_client.chat(
            model=chat_engine.config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
            stream=True,
        ):
            if "message" in chunk and "content" in chunk["message"]:
                yield {
                    "type": "chunk",
                    "content": chunk["message"]["content"],
                }

        # Yield the function response at the end
        yield {
            "type": "function_response",
            "content": function_response,
        }
