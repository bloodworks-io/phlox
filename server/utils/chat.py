import logging
import json
from numpy import cos
import chromadb
from chromadb.config import Settings
from chromadb.utils.embedding_functions import (
    OllamaEmbeddingFunction,
    OpenAIEmbeddingFunction,
)
import re
from server.database.config import config_manager
from server.utils.helpers import clean_think_tags
from server.utils.llm_client import get_llm_client, LLMProviderType
from server.constants import DATA_DIR

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

        # Get user settings for doctor's name and specialty
        user_settings = config_manager.get_user_settings()
        doctor_name = user_settings.get("name", "")
        specialty = user_settings.get("specialty", "")

        # Configure logging for the chat class
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)

        self.CHAT_SYSTEM_MESSAGE = [
            {
                "role": "system",
                "content": self.prompts["prompts"]["chat"]["system"],
            }
        ]

        # Add doctor context as additional system message if available
        if doctor_name or specialty:
            doctor_context = "You are assisting."
            if doctor_name and specialty:
                doctor_context += f"{doctor_name}, a {specialty} specialist."
            elif doctor_name:
                doctor_context += f"{doctor_name}."
            else:
                doctor_context += f"a {specialty} specialist."

            self.CHAT_SYSTEM_MESSAGE.append(
                {"role": "system", "content": doctor_context}
            )

        # Get the unified LLM client instead of Ollama-specific client
        self.llm_client = get_llm_client()

        self.chroma_client = self._initialize_chroma_client()
        self.embedding_model = self._initialize_embedding_model()
        self.last_successful_collection = "misc"

    def _initialize_chroma_client(self):
        """
        Initialize and return a ChromaDB client.

        Returns:
            chromadb.PersistentClient: An instance of the ChromaDB client.
        """
        return chromadb.PersistentClient(
            path=str(DATA_DIR / "chroma"),
            settings=Settings(anonymized_telemetry=False, allow_reset=True),
        )

    def _initialize_embedding_model(self):
        """
        Initialize and return an embedding model based on the provider type.

        Returns:
            An embedding function compatible with the current provider.
        """
        provider_type = self.config.get("LLM_PROVIDER", "ollama").lower()

        if provider_type == LLMProviderType.OLLAMA.value:
            return OllamaEmbeddingFunction(
                url=f"{self.config['LLM_BASE_URL']}/api/embeddings",
                model_name=self.config["EMBEDDING_MODEL"],
            )
        elif provider_type == LLMProviderType.OPENAI_COMPATIBLE.value:
            return OpenAIEmbeddingFunction(
                model_name=self.config["EMBEDDING_MODEL"],
                api_key=self.config.get("LLM_API_KEY", "cant-be-empty"),
                api_base=f"{self.config['LLM_BASE_URL']}/v1",
            )
        else:
            raise ValueError(f"Unsupported LLM provider type: {provider_type}")

    def sanitizer(self, disease_name: str) -> str:
        """
        Sanitize the disease name for use as a collection name.

        Args:
            disease_name (str): The raw disease name.

        Returns:
            str: The sanitized disease name.
        """
        return (
            re.sub(r"[.\(\n/].*", "", disease_name.lower().replace(" ", "_"))
            .rstrip("_")
            .strip()
        )

    def get_relevant_literature(self, disease_name: str, question: str) -> str:
        """
        Retrieve relevant literature for a given disease and question.

        Args:
            disease_name (str): The name of the disease.
            question (str): The question to search for in the literature.

        Returns:
            str: Relevant literature excerpts or a message if no literature is found.
        """
        self.logger.info(
            f"Searching literature for disease: '{disease_name}' with query: '{question}'"
        )
        collection_names = self.chroma_client.list_collections()
        sanitized_disease_name = self.sanitizer(disease_name)

        self.logger.info(f"Sanitized disease name: '{sanitized_disease_name}'")
        self.logger.info(f"Available collections: {collection_names}")

        if sanitized_disease_name in collection_names:
            self.logger.info(
                f"Found matching collection for '{sanitized_disease_name}'"
            )
            try:
                self.logger.info(
                    f"Retrieving collection '{sanitized_disease_name}' with embedding model"
                )
                collection = self.chroma_client.get_collection(
                    name=sanitized_disease_name,
                    embedding_function=self.embedding_model,
                )

                self.logger.info(
                    f"Querying collection with question: '{question}'"
                )
                context = collection.query(
                    query_texts=[question],
                    n_results=5,
                    include=["documents", "metadatas", "distances"],
                )

                self.logger.info(
                    f"Query completed, received {len(context['documents'][0])} results"
                )
                self.logger.info(f"Result distances: {context['distances'][0]}")
            except Exception as e:
                self.logger.error(f"Error querying collection: {e}")
                return "No relevant literature available"

            output_strings = []

            # Apply distance threshold filter
            distance_threshold = 0.2
            self.logger.info(
                f"Filtering results with distance threshold: {distance_threshold}"
            )

            for i, doc_list in enumerate(context["documents"]):
                for j, doc in enumerate(doc_list):
                    distance = context["distances"][i][j]
                    self.logger.info(f"Document {j+1}: distance={distance}")
                    if distance > distance_threshold:
                        source = context["metadatas"][i][j]["source"]
                        formatted_source = source.replace("_", " ").title()
                        cleaned_doc = doc.strip().replace("\n", " ")
                        self.logger.info(
                            f"Adding document from source: {formatted_source} (distance: {distance})"
                        )
                        output_strings.append(
                            f'According to {formatted_source}:\n\n"...{cleaned_doc}..."\n'
                        )
                    else:
                        self.logger.info(
                            f"Skipping document with distance {distance} (below threshold)"
                        )

            if not output_strings:
                self.logger.info("No relevant literature matching query found.")
                return "No relevant literature matching your query was found"

            self.logger.info(
                f"Retrieved {len(output_strings)} relevant literature excerpts."
            )
            return output_strings
        else:
            self.logger.info(
                f"No collection found for disease: {sanitized_disease_name}"
            )
            return "No relevant literature available"

    def _get_tools_definition(self, collection_names):
        """
        Get the tools definition based on available collections.
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

    async def get_streaming_response(
        self, conversation_history: list, raw_transcription=None
    ):
        """
        Generate a streaming response based on the conversation history and relevant literature.
        """
        prompts = config_manager.get_prompts_and_options()
        collection_names = self.chroma_client.list_collections()

        context_question_options = prompts["options"]["general"]
        context_question_options.pop("stop", None)
        print(context_question_options)

        # Clean <think> tags from conversation history as these are not required for new model responses and take up valuable context.
        cleaned_conversation_history = clean_think_tags(conversation_history)

        message_list = self.CHAT_SYSTEM_MESSAGE + cleaned_conversation_history

        # First call to determine if we need literature or direct response
        self.logger.info("Initial LLM call to determine tool usage...")

        # Get tool definitions
        tools = self._get_tools_definition(collection_names)

        try:
            # Use the unified LLM client instead of directly calling Ollama
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
                yield {"type": "status", "content": "Generating response..."}
                # Stream direct response
                async for chunk in await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=message_list,
                    options=context_question_options,
                    stream=True,
                ):
                    if "message" in chunk and "content" in chunk["message"]:
                        yield {
                            "type": "chunk",
                            "content": chunk["message"]["content"],
                        }
            else:
                # Extract the tool call information
                tool = tool_calls[0]
                function_name = tool["function"]["name"]
                function_arguments = None

                if "arguments" in tool["function"]:
                    # Parse function arguments from JSON string if needed
                    try:
                        if isinstance(tool["function"]["arguments"], str):
                            function_arguments = json.loads(
                                tool["function"]["arguments"]
                            )
                        else:
                            function_arguments = tool["function"]["arguments"]
                    except json.JSONDecodeError:
                        self.logger.error(
                            "Failed to parse function arguments JSON"
                        )
                        function_arguments = {}

                self.logger.info(f"LLM chose tool: {function_name}")

                # Add the tool call to the message list
                message_list.append(response["message"])

                if function_name == "direct_response":
                    self.logger.info("Executing direct response...")
                    yield {
                        "type": "status",
                        "content": "Generating response...",
                    }

                    # For direct response, we don't need to add tool results, just stream response
                    async for chunk in await self.llm_client.chat(
                        model=self.config["PRIMARY_MODEL"],
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
                    self.logger.info("Executing query_transcript tool...")
                    # Check if transcript is available
                    if not raw_transcription:
                        self.logger.info("No transcript available.")
                        yield {
                            "type": "status",
                            "content": "Generating response...",
                        }
                        # No transcript available, inform the user
                        message_list.append(
                            {
                                "role": "tool",
                                "tool_call_id": tool.get("id", ""),
                                "content": "No transcript is available to query. Please answer the user's question without transcript information.",
                            }
                        )

                        async for chunk in await self.llm_client.chat(
                            model=self.config["PRIMARY_MODEL"],
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
                        self.logger.info("Searching transcript for query...")
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
                        transcript_response = await self.llm_client.chat(
                            model=self.config["PRIMARY_MODEL"],
                            messages=transcript_query_messages,
                            options=context_question_options,
                        )

                        transcript_info = transcript_response["message"][
                            "content"
                        ]

                        # Clean think tags
                        cleaned_transcript_info = clean_think_tags(
                            [{"content": transcript_info}]
                        )[0]["content"]

                        self.logger.info(
                            f"Transcript query result: {cleaned_transcript_info[:200]}..."
                        )

                        # Add transcript info to original conversation as a tool response
                        message_list.append(
                            {
                                "role": "tool",
                                "tool_call_id": tool.get("id", ""),
                                "content": f"The following information was found in the transcript:\n\n{cleaned_transcript_info}",
                            }
                        )

                        # Send generating response status
                        yield {
                            "type": "status",
                            "content": "Generating response with transcript information...",
                        }

                        self.logger.info(
                            f"Starting response stream to frontend"
                        )

                        # Stream the answer
                        async for chunk in await self.llm_client.chat(
                            model=self.config["PRIMARY_MODEL"],
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

                        function_response = None  # No need to send the tools response to the frontend
                else:  # get_relevant_literature
                    self.logger.info(
                        "Executing get_relevant_literature tool..."
                    )
                    # Send RAG status message
                    yield {
                        "type": "status",
                        "content": "Searching medical literature...",
                    }

                    # Get disease_name and question from function arguments
                    disease_name = function_arguments.get("disease_name", "")
                    question = function_arguments.get("question", "")

                    function_response_list = self.get_relevant_literature(
                        disease_name,
                        question,
                    )

                    if (
                        function_response_list
                        == "No relevant literature available"
                    ):
                        self.logger.info(
                            "No relevant literature found in database."
                        )
                        # Add the tool response to the message list
                        message_list.append(
                            {
                                "role": "tool",
                                "tool_call_id": tool.get("id", ""),
                                "content": "No relevant literature available in the database. Answer the user's question but inform them that you were unable to find any relevant information.",
                            }
                        )
                        function_response = None
                    else:
                        self.logger.info(
                            f"Retrieved relevant literature for disease: {disease_name}"
                        )
                        function_response_string = "\n".join(
                            function_response_list
                        )

                        # Add the tool response to the message list
                        message_list.append(
                            {
                                "role": "tool",
                                "tool_call_id": tool.get("id", ""),
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
                    async for chunk in await self.llm_client.chat(
                        model=self.config["PRIMARY_MODEL"],
                        messages=message_list,
                        options=context_question_options,
                        stream=True,
                    ):
                        if "message" in chunk and "content" in chunk["message"]:
                            yield {
                                "type": "chunk",
                                "content": chunk["message"]["content"],
                            }

        except Exception as e:
            self.logger.error(f"Error processing tool call: {str(e)}")
            yield {
                "type": "status",
                "content": "Error processing request. Generating direct response...",
            }

            # Fallback to direct response in case of error
            async for chunk in await self.llm_client.chat(
                model=self.config["PRIMARY_MODEL"],
                messages=message_list,
                options=context_question_options,
                stream=True,
            ):
                if "message" in chunk and "content" in chunk["message"]:
                    yield {
                        "type": "chunk",
                        "content": chunk["message"]["content"],
                    }

            function_response = None

        # Signal end of stream with function_response if available
        self.logger.info("Streaming chat completed.")
        yield {
            "type": "end",
            "content": "",
            "function_response": function_response,
        }

    async def stream_chat(
        self, conversation_history: list, raw_transcription=None
    ):
        """Stream chat response from the LLM"""
        try:
            self.logger.info("Starting LLM stream...")
            yield {"type": "start", "content": ""}

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
