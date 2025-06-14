import fitz  # PyMuPDF
from .semantic_chunker import ClusterSemanticChunker
import chromadb
from chromadb.config import Settings
from chromadb.utils.embedding_functions import (
    OllamaEmbeddingFunction,
    OpenAIEmbeddingFunction,
)
import re
import asyncio
from server.constants import DATA_DIR
from server.database.config import config_manager
from server.utils.llm_client import get_llm_client, LLMProviderType

prompts = config_manager.get_prompts_and_options()


class ChromaManager:
    """
    Manages interactions with the Chroma vector database for document storage and retrieval.
    """

    def __init__(self):
        """
        Initializes the ChromaManager with configuration settings and clients.
        """
        self.config = config_manager.get_config()
        self.prompts = config_manager.get_prompts_and_options()

        # Initialize embedding function based on provider type
        provider_type = self.config.get("LLM_PROVIDER", "ollama").lower()

        if provider_type == LLMProviderType.OLLAMA.value:
            self.embedding_model = OllamaEmbeddingFunction(
                url=f"{self.config['LLM_BASE_URL']}/api/embeddings",
                model_name=self.config["EMBEDDING_MODEL"],
            )
        elif provider_type == LLMProviderType.OPENAI_COMPATIBLE.value:
            self.embedding_model = OpenAIEmbeddingFunction(
                model_name=self.config["EMBEDDING_MODEL"],
                api_key=self.config.get("LLM_API_KEY", "cant-be-empty"),
                api_base=f"{self.config['LLM_BASE_URL']}/v1",
            )
        else:
            raise ValueError(f"Unsupported LLM provider type: {provider_type}")

        # Create the LLM client
        self.llm_client = get_llm_client()

        # Initialize Chroma client
        self.chroma_client = chromadb.PersistentClient(
            path=str(DATA_DIR / "chroma"),
            settings=Settings(anonymized_telemetry=False, allow_reset=True),
        )
        self.extracted_text_store = None

        # Check if using a model that requires the thinking step
        model_name = self.config["PRIMARY_MODEL"].lower()
        self.uses_thinking_step = "qwen3" in model_name

    async def process_with_thinking(
        self, messages, options=None, completion_prompt=None
    ):
        """
        Process a request with or without thinking step based on model.

        Args:
            messages (list): The message list for the chat
            options (dict, optional): Custom options for the API call
            completion_prompt (str, optional): Text to add to assistant's response to complete it

        Returns:
            dict: The response from the LLM
        """
        if options is None:
            options = {
                **self.prompts["options"]["chat"],  # Unpack the chat options
                "stop": [".", "(", "\n", "/"],  # Add the stop tokens
            }

        if not self.uses_thinking_step:
            # For models that don't need thinking step
            if completion_prompt:
                messages.append(
                    {"role": "assistant", "content": completion_prompt}
                )
            return await self.llm_client.chat(
                model=self.config["PRIMARY_MODEL"],
                messages=messages,
                options=options,
            )

        # For models that use thinking step
        thinking_messages = messages.copy()
        thinking_messages.append({"role": "assistant", "content": "<think>"})

        thinking_options = options.copy()
        thinking_options["stop"] = ["</think>"]

        thinking_response = await self.llm_client.chat(
            model=self.config["PRIMARY_MODEL"],
            messages=thinking_messages,
            options=thinking_options,
        )

        thinking = (
            "<think>" + thinking_response["message"]["content"] + "</think>"
        )

        # Complete message with thinking
        complete_messages = messages.copy()
        complete_messages.append({"role": "assistant", "content": thinking})

        if completion_prompt:
            complete_messages.append(
                {"role": "assistant", "content": completion_prompt}
            )

        return await self.llm_client.chat(
            model=self.config["PRIMARY_MODEL"],
            messages=complete_messages,
            options=options,
        )

    def commit_to_vectordb(
        self, disease_name, focus_area, document_source, filename
    ):
        """
        Commits extracted text to the vector database.

        Args:
            disease_name (str): Name of the disease.
            focus_area (str): Focus area of the document.
            document_source (str): Source of the document.
            filename (str): Name of the file.

        Raises:
            ValueError: If extracted text is not available.
        """

        try:
            if self.extracted_text_store is None:
                raise ValueError(
                    "Extracted text not available. Please extract the PDF information first."
                )

            chunker = ClusterSemanticChunker(
                embedding_function=self.embedding_model,
                max_chunk_size=500,
                min_chunk_size=150,
            )

            texts = chunker.split_text(self.extracted_text_store)

            collection = self.chroma_client.get_or_create_collection(
                name=disease_name,
                embedding_function=self.embedding_model,
                metadata={"hnsw:space": "cosine"},
            )

            metadatas = [
                {
                    "disease_name": disease_name,
                    "focus_area": focus_area,
                    "source": document_source,
                    "filename": filename,
                }
                for _ in range(len(texts))
            ]
            ids = [f"{filename}_{idx}" for idx in range(len(texts))]

            collection.add(documents=texts, metadatas=metadatas, ids=ids)
            print("Documents successfully added to the collection.")
        except Exception as e:
            print(f"An error occurred: {e}")

    @staticmethod
    def format_to_collection_name(human_readable_name):
        """
        Formats a human-readable name to a collection name.

        Args:
            human_readable_name (str): Human-readable name.

        Returns:
            str: Formatted collection name.
        """
        return human_readable_name.lower().replace(" ", "_")

    def list_collections(self):
        """
        Lists all collections in the Chroma database.

        Returns:
            list: List of collection names.
        """
        try:
            collections = self.chroma_client.list_collections()
            print(f"Collections:{collections}")
            return sorted(collections)
        except Exception as e:
            print("Error retrieving collections:", e)
            return []

    def get_files_for_collection(self, collection_name):
        """
        Retrieves files associated with a specific collection.

        Args:
            collection_name (str): Name of the collection.

        Returns:
            list: List of file names in the collection.
        """
        try:
            formatted_name = self.format_to_collection_name(collection_name)
            collection = self.chroma_client.get_collection(
                name=formatted_name, embedding_function=self.embedding_model
            )
            context = collection.get(
                where={"disease_name": formatted_name}, include=["metadatas"]
            )
            unique_ids = {re.sub(r"_\d*", "", id_) for id_ in context["ids"]}
            return list(unique_ids)
        except Exception as e:
            print(
                f"Error retrieving files for collection '{collection_name}':", e
            )
            return []

    def delete_file_from_collection(self, collection_name, file_name):
        """
        Deletes a file from a specific collection.

        Args:
            collection_name (str): Name of the collection.
            file_name (str): Name of the file to delete.

        Returns:
            bool: True if deletion was successful, False otherwise.
        """
        try:
            formatted_name = self.format_to_collection_name(collection_name)
            collection = self.chroma_client.get_collection(
                name=formatted_name, embedding_function=self.embedding_model
            )
            result = collection.get(
                where={"disease_name": formatted_name}, include=["metadatas"]
            )
            ids_to_delete = [
                id
                for id in result["ids"]
                if re.sub(r"_\d*$", "", id) == file_name
            ]
            if ids_to_delete:
                collection.delete(ids=ids_to_delete)
                print(
                    f"Deleted {len(ids_to_delete)} entries for file '{file_name}' from collection '{formatted_name}'"
                )
            else:
                print(
                    f"No matching entries found for file '{file_name}' in collection '{formatted_name}'"
                )
            return True
        except Exception as e:
            print(
                f"Error deleting file from collection '{collection_name}': {e}"
            )
            return False

    def modify_collection_name(self, old_name, new_name):
        """
        Modifies the name of a collection.

        Args:
            old_name (str): Current name of the collection.
            new_name (str): New name for the collection.

        Returns:
            bool: True if renaming was successful, False otherwise.
        """
        try:
            old_name_formatted = self.format_to_collection_name(old_name)
            new_name_formatted = self.format_to_collection_name(new_name)
            collection = self.chroma_client.get_collection(
                name=old_name_formatted, embedding_function=self.embedding_model
            )
            collection.modify(name=new_name_formatted)
            print(
                f"Collection '{old_name_formatted}' renamed to '{new_name_formatted}'"
            )
            return True
        except Exception as e:
            print(f"Error renaming collection '{old_name}':", e)
            return False

    def delete_collection(self, name):
        """
        Deletes a collection from the Chroma database.

        Args:
            name (str): Name of the collection to delete.

        Returns:
            bool: True if deletion was successful, False otherwise.
        """
        try:
            name_formatted = self.format_to_collection_name(name)
            self.chroma_client.delete_collection(name=name_formatted)
            print(f"Collection '{name_formatted}' deleted")
            return True
        except Exception as e:
            print(f"Error deleting collection '{name}':", e)
            return False

    def list_sources_from_all_collections(self):
        """
        Lists all unique document sources across all collections.

        Returns:
            list: List of unique document sources.
        """
        all_sources = set()
        try:
            collections = self.chroma_client.list_collections()
            for collection in collections:
                items = collection.get(include=["metadatas"])
                for item in items["metadatas"]:
                    if item and "source" in item:
                        all_sources.add(item["source"])
            return list(all_sources)
        except Exception as e:
            print(f"An error occurred: {e}")
            return []

    def set_extracted_text(self, text):
        """
        Sets the extracted text to be used for vector database operations.

        Args:
            text (str): Extracted text from a document.
        """
        self.extracted_text_store = text

    def extract_text_from_pdf(self, pdf_path):
        """
        Extracts text from a PDF file.

        Args:
            pdf_path (str): Path to the PDF file.

        Returns:
            str: Extracted text from the PDF.
        """
        text = ""
        document = fitz.open(pdf_path)
        for page_num in range(len(document)):
            page = document.load_page(page_num)
            text += page.get_text()
        return text

    async def get_disease_name(self, text):
        """
        Determines the disease name from the extracted text.

        Args:
            text (str): Extracted text from the document.

        Returns:
            str: Determined disease name.
        """
        from server.schemas.grammars import DiseaseNameResponse

        collection_names = self.chroma_client.list_collections()
        collection_names_string = ", ".join(collection_names)

        words = text.split()
        sample_text = " ".join(words[:500])

        disease_question_options = {
            **prompts["options"]["chat"],  # Unpack the chat options
        }
        disease_question_options["stop"] = [".", " "]

        # Initial disease question messages
        initial_messages = [
            {
                "role": "system",
                "content": self.prompts["prompts"]["chat"]["system"],
            },
            {
                "role": "user",
                "content": f"{sample_text}\n\nIs the above block of specifically addressing any of the following list of diseases? {collection_names_string}\nAnswer Yes or No.",
            },
        ]

        disease_question = await self.process_with_thinking(
            initial_messages, disease_question_options
        )

        # Reset disease_question_options
        disease_question_options = {
            **prompts["options"]["chat"],  # Unpack the chat options
        }
        disease_answer = disease_question["message"]["content"].strip()
        sanitized_disease_answer = disease_answer.lower().replace(" ", "_")

        if sanitized_disease_answer == "yes":
            # Initial messages for "Yes" path
            initial_messages = [
                {
                    "role": "system",
                    "content": self.prompts["prompts"]["chat"]["system"],
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nIs the above block of text *primarily* related to any of the following list of diseases? {collection_names_string}\nAnswer Yes or No. ONLY",
                },
                {
                    "role": "assistant",
                    "content": "Yes",
                },
                {
                    "role": "user",
                    "content": f"Here is the list again:\n{collection_names_string}\nIdentify the disease name from this list that the text is about. Return the disease name in lowercase with underscores instead of spaces and in valid JSON.",
                },
            ]

            # Get response with structured format
            response_format = {
                "type": "json_object",
                "schema": DiseaseNameResponse.schema(),
            }

            # For models that use thinking step
            if self.uses_thinking_step:
                # First get thinking
                thinking_messages = initial_messages.copy()
                thinking_messages.append(
                    {"role": "assistant", "content": "<think>"}
                )

                thinking_options = disease_question_options.copy()
                thinking_options["stop"] = ["</think>"]

                thinking_response = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=thinking_messages,
                    options=thinking_options,
                )

                thinking = (
                    "<think>"
                    + thinking_response["message"]["content"]
                    + "</think>"
                )

                # Complete message with thinking
                complete_messages = initial_messages.copy()
                complete_messages.append(
                    {"role": "assistant", "content": thinking}
                )
                print(f"HERE: {complete_messages}", flush=True)
                disease_choice = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=complete_messages,
                    format=response_format,
                    options=disease_question_options,
                )
            else:
                disease_choice = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=initial_messages,
                    format=response_format,
                    options=disease_question_options,
                )

            disease_name = disease_choice["message"]["content"]["disease_name"]
        else:
            # Initial messages for "No" path
            initial_messages = [
                {
                    "role": "system",
                    "content": self.prompts["prompts"]["chat"]["system"],
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nIs the above block of text related to any of the following list of diseases? {collection_names_string}\nAnswer Yes or No.",
                },
                {
                    "role": "assistant",
                    "content": "No",
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nWhat is the disease that the above block of text is referring to? Identify the disease name and return it in lowercase with underscores instead of spaces. Do not use acronyms. If there is more than one disease, then respond with only the name of the main disease of the text. Respond in valid JSON.",
                },
            ]

            # Get response with structured format
            response_format = DiseaseNameResponse.model_json_schema()

            # For models that use thinking step
            if self.uses_thinking_step:
                # First get thinking
                thinking_messages = initial_messages.copy()
                thinking_messages.append(
                    {"role": "assistant", "content": "<think>"}
                )

                thinking_options = disease_question_options.copy()
                thinking_options["stop"] = ["</think>"]

                thinking_response = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=thinking_messages,
                    options=thinking_options,
                )

                thinking = (
                    "<think>"
                    + thinking_response["message"]["content"]
                    + "</think>"
                )

                # Complete message with thinking
                complete_messages = initial_messages.copy()
                complete_messages.append(
                    {"role": "assistant", "content": thinking}
                )

                disease_choice = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=complete_messages,
                    format=response_format,
                    options=disease_question_options,
                )

            else:
                disease_choice = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=initial_messages,
                    format=response_format,
                    options=disease_question_options,
                )

            validated_response = DiseaseNameResponse.model_validate_json(
                disease_choice["message"]["content"]
            )

        disease_name = validated_response.disease_name

        return disease_name

    async def get_focus_area(self, text):
        """
        Determines the focus area of the document.

        Args:
            text (str): Extracted text from the document.

        Returns:
            str: Determined focus area.
        """
        from server.schemas.grammars import FocusAreaResponse

        words = text.split()
        sample_text = " ".join(words[:500])

        disease_question_options = {
            **prompts["options"]["chat"],  # Unpack the chat options
        }

        # Focus area determination
        focus_area_messages = [
            {
                "role": "system",
                "content": self.prompts["prompts"]["chat"]["system"],
            },
            {
                "role": "user",
                "content": f"{sample_text}\n\nIdentify whether the block of text is primarily focused on guidelines, diagnosis, treatment, epidemiology, pathophysiology, prognosis, clinical features, prevention, or miscellaneous. Return the PRIAMRY focus area in lowercase, and with underscores instead of spaces. Answer in valid JSON.",
            },
        ]

        # Get response with structured format
        response_format = FocusAreaResponse.model_json_schema()

        # For models that use thinking step
        if self.uses_thinking_step:
            # First get thinking
            thinking_messages = focus_area_messages.copy()
            thinking_messages.append(
                {"role": "assistant", "content": "<think>"}
            )

            thinking_options = disease_question_options.copy()
            thinking_options["stop"] = ["</think>"]

            thinking_response = await self.llm_client.chat(
                model=self.config["PRIMARY_MODEL"],
                messages=thinking_messages,
                options=thinking_options,
            )

            thinking = (
                "<think>" + thinking_response["message"]["content"] + "</think>"
            )

            # Complete message with thinking
            complete_messages = focus_area_messages.copy()
            complete_messages.append({"role": "assistant", "content": thinking})

            focus_area_response = await self.llm_client.chat(
                model=self.config["PRIMARY_MODEL"],
                messages=complete_messages,
                format=response_format,
                options=disease_question_options,
            )

        else:
            focus_area_response = await self.llm_client.chat(
                model=self.config["PRIMARY_MODEL"],
                messages=focus_area_messages,
                format=response_format,
                options=disease_question_options,
            )

        # Add validation step here
        validated_response = FocusAreaResponse.model_validate_json(
            focus_area_response["message"]["content"]
        )

        focus_area = validated_response.focus_area

        return focus_area

    async def get_document_source(self, text):
        """
        Determines the source of the document.

        Args:
            text (str): Extracted text from the document.

        Returns:
            str: Determined document source.
        """
        from server.schemas.grammars import DocumentSourceResponse

        words = text.split()
        sample_text = " ".join(words[:250])

        existing_sources = self.list_sources_from_all_collections()
        existing_sources_string = ", ".join(existing_sources)

        disease_question_options = {
            **prompts["options"]["chat"],  # Unpack the chat options
        }

        # Document source determination
        source_question_messages = [
            {
                "role": "system",
                "content": self.prompts["prompts"]["chat"]["system"],
            },
            {
                "role": "user",
                "content": f"{sample_text}\n\nIs the source of this document one of the following? {existing_sources_string}\nAnswer Yes or No.",
            },
        ]

        document_source_question = await self.process_with_thinking(
            source_question_messages, disease_question_options
        )

        source_answer = (
            document_source_question["message"]["content"].strip().lower()
        )

        if source_answer == "yes":
            # Initial messages for "Yes" source path
            initial_messages = [
                {
                    "role": "system",
                    "content": self.prompts["prompts"]["chat"]["system"],
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nWhich of the following sources is this document from? {existing_sources_string}\nIdentify the source name and return it in lowercase with underscores instead of spaces.",
                },
            ]

            # Get response with structured format
            response_format = DocumentSourceResponse.model_json_schema()

            # For models that use thinking step
            if self.uses_thinking_step:
                # First get thinking
                thinking_messages = initial_messages.copy()
                thinking_messages.append(
                    {"role": "assistant", "content": "<think>"}
                )

                thinking_options = disease_question_options.copy()
                thinking_options["stop"] = ["</think>"]

                thinking_response = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=thinking_messages,
                    options=thinking_options,
                )

                thinking = (
                    "<think>"
                    + thinking_response["message"]["content"]
                    + "</think>"
                )

                # Complete message with thinking
                complete_messages = initial_messages.copy()
                complete_messages.append(
                    {"role": "assistant", "content": thinking}
                )

                document_source_choice = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=complete_messages,
                    format=response_format,
                    options=disease_question_options,
                )
            else:
                document_source_choice = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=initial_messages,
                    format=response_format,
                    options=disease_question_options,
                )

            # Add validation
            validated_response = DocumentSourceResponse.model_validate_json(
                document_source_choice["message"]["content"]
            )
            document_source = validated_response.source
        else:
            # Initial messages for "No" source path
            initial_messages = [
                {
                    "role": "system",
                    "content": self.prompts["prompts"]["chat"]["system"],
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nWhat is the source of this document? Identify the source name and return it in lowercase with underscores instead of spaces.",
                },
            ]

            # Get response with structured format
            response_format = DocumentSourceResponse.model_json_schema()

            # For models that use thinking step
            if self.uses_thinking_step:
                # First get thinking
                thinking_messages = initial_messages.copy()
                thinking_messages.append(
                    {"role": "assistant", "content": "<think>"}
                )

                thinking_options = disease_question_options.copy()
                thinking_options["stop"] = ["</think>"]

                thinking_response = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=thinking_messages,
                    options=thinking_options,
                )

                thinking = (
                    "<think>"
                    + thinking_response["message"]["content"]
                    + "</think>"
                )

                # Complete message with thinking
                complete_messages = initial_messages.copy()
                complete_messages.append(
                    {"role": "assistant", "content": thinking}
                )

                document_source_response = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=complete_messages,
                    format=response_format,
                    options=disease_question_options,
                )
            else:
                document_source_response = await self.llm_client.chat(
                    model=self.config["PRIMARY_MODEL"],
                    messages=initial_messages,
                    format=response_format,
                    options=disease_question_options,
                )

            # Add validation
            validated_response = DocumentSourceResponse.model_validate_json(
                document_source_response["message"]["content"]
            )
            document_source = validated_response.source

        return document_source
