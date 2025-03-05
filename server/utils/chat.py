from numpy import cos
import chromadb
from chromadb.config import Settings
from chromadb.utils.embedding_functions import OllamaEmbeddingFunction
from ollama import AsyncClient as ollamaClient
import re
from server.database.config import config_manager
import logging
import asyncio
import sys

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

            self.CHAT_SYSTEM_MESSAGE.append({
                "role": "system",
                "content": doctor_context
            })

        self.BASE_URL = self.config["OLLAMA_BASE_URL"]
        self.ollama_client = ollamaClient(host=self.BASE_URL)
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
            path="/usr/src/app/data/chroma",
            settings=Settings(anonymized_telemetry=False, allow_reset=True),
        )

    def _initialize_embedding_model(self):
        """
        Initialize and return an Ollama embedding model.

        Returns:
            OllamaEmbeddingFunction: An instance of the Ollama embedding model.
        """
        return OllamaEmbeddingFunction(
            url=f"{self.BASE_URL}/api/embeddings",
            model_name=f"{self.config['EMBEDDING_MODEL']}",
        )

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

        collection_names = self.chroma_client.list_collections()

        sanitized_disease_name = self.sanitizer(disease_name)

        if sanitized_disease_name in collection_names:

            try:
                collection = self.chroma_client.get_collection(
                    name=sanitized_disease_name,
                    embedding_function=self.embedding_model
                )
                context = collection.query(
                    query_texts=[question],
                    n_results=5,
                    include=["documents", "metadatas", "distances"]
                )


            except Exception as e:
                return "No relevant literature available"

            output_strings = []

            # Apply distance threshold filter
            distance_threshold = 0.3

            for i, doc_list in enumerate(context["documents"]):
                for j, doc in enumerate(doc_list):

                    if context["distances"][i][j] > distance_threshold:
                        source = context["metadatas"][i][j]["source"]
                        formatted_source = source.replace("_", " ").title()
                        cleaned_doc = doc.strip().replace("\n", " ")
                        output_strings.append(
                            f'According to {formatted_source}:\n\n"...{cleaned_doc}..."\n'
                        )

            if not output_strings:
                return "No relevant literature matching your query was found"

            return output_strings
        else:
            return "No relevant literature available"

    async def get_streaming_response(self, conversation_history: list):
        """
        Generate a streaming response based on the conversation history and relevant literature.
        """
        prompts = config_manager.get_prompts_and_options()
        collection_names = self.chroma_client.list_collections()
        collection_names_string = ", ".join(collection_names)

        context_question_options = prompts["options"]["chat"]
        message_list = self.CHAT_SYSTEM_MESSAGE + conversation_history

        # First call to determine if we need literature or direct response
        response = await self.ollama_client.chat(
            model=self.config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "direct_response",
                        "description": "Use this tool if the most recent question from the user is a non-medical query (greetings, chat, clarifications).",
                        "parameters": {
                            "type": "object",
                            "properties": {},
                            "required": [],
                        },
                    },
                },
                {
                    "type": "function",
                    "function": {
                        "name": "get_relevant_literature",
                        "description": f"Only use this tool if answering the most recent message from the user would benefit from a literature search. Available disease areas:{collection_names_string}, other",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "disease_name": {"type": "string", "description": f"The disease that this question is referring to (must be one of: {collection_names_string}, other)"},
                                "question": {"type": "string", "description": "The question to be answered. Try and be specific and succinct."},
                            },
                            "required": ["disease_name", "question"],
                        },
                    },
                },
            ],
        )

        function_response = None

        if not response["message"].get("tool_calls"):
            yield {"type": "status", "content": "Generating response..."}
            # Stream direct response
            async for chunk in await self.ollama_client.chat(
                model=self.config["PRIMARY_MODEL"],
                messages=message_list,
                options=context_question_options,
                stream=True
            ):
                if 'message' in chunk and 'content' in chunk['message']:
                    yield {"type": "chunk", "content": chunk['message']['content']}
        else:
            tool = response["message"]["tool_calls"][0]
            if tool["function"]["name"] == "direct_response":
                yield {"type": "status", "content": "Generating response..."}
                # Stream direct response
                async for chunk in await self.ollama_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=message_list,
                    options=context_question_options,
                    stream=True
                ):
                    if 'message' in chunk and 'content' in chunk['message']:
                        yield {"type": "chunk", "content": chunk['message']['content']}
            else:  # get_relevant_literature
                # Send RAG status message
                yield {"type": "status", "content": "Searching medical literature..."}

                function_response_list = self.get_relevant_literature(
                    tool["function"]["arguments"]["disease_name"],
                    tool["function"]["arguments"]["question"],
                )
                function_response_string = "\n".join(function_response_list)

                if function_response_list == "No relevant literature available":
                    context_response = {
                        "role": "tool",
                        "content": "No relevant literature available in the database. Answer the user's question but inform them that you were unable to find any relevant information.",
                    }
                    function_response = None
                else:
                    context_response = {
                        "role": "tool",
                        "content": f"The below text excerpts are taken from relevant sections of the guidelines; these may help you answer the user's question. The user has not sent you these documents, they have come from your own database.\n\n{function_response_string}",
                    }
                    function_response = function_response_list

                temp_conversation_history = message_list + [context_response]

                # Send generating response status
                yield {"type": "status", "content": "Generating response with retrieved information..."}

                # Stream the context answer
                async for chunk in await self.ollama_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=temp_conversation_history,
                    options=context_question_options,
                    stream=True
                ):
                    if 'message' in chunk and 'content' in chunk['message']:
                        yield {"type": "chunk", "content": chunk['message']['content']}

        # Signal end of stream with function_response if available
        yield {"type": "end", "content": "", "function_response": function_response}

    async def stream_chat(self, conversation_history: list):
        """Stream chat response from Ollama"""
        try:
            print("Starting Ollama stream")
            yield {"type": "start", "content": ""}

            async for chunk in self.get_streaming_response(conversation_history):
                yield chunk

        except Exception as e:
            logging.error(f"Error in stream_chat: {e}")
            raise


# Usage
def main():
    """
    Main interface for chat interactions.

    Args:
        conversation_history (list): A list of previous messages in the conversation.

    Returns:
        dict: The response from get_response method.
    """
    chat_engine = ChatEngine()
    conversation_history = [
        {"role": "user", "content": "What are the symptoms of diabetes?"}
    ]
    response = chat_engine.chat(conversation_history)
    print(response)


if __name__ == "__main__":
    main()
