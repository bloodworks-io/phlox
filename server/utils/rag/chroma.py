import asyncio
import json
import logging
import re

import chromadb
import fitz  # PyMuPDF
from chromadb.config import Settings
from chromadb.utils.embedding_functions import (
    OllamaEmbeddingFunction,
    OpenAIEmbeddingFunction,
)

from server.constants import DATA_DIR
from server.database.config.manager import config_manager
from server.utils.llm_client.base import LLMProviderType
from server.utils.llm_client.client import get_llm_client

from .semantic_chunker import ClusterSemanticChunker

prompts = config_manager.get_prompts_and_options()

logger = logging.getLogger(__name__)


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

        # Get base URL with default for Ollama
        base_url = self.config.get("LLM_BASE_URL") or "http://127.0.0.1:11434"

        if provider_type == LLMProviderType.OLLAMA.value:
            self.embedding_model = OllamaEmbeddingFunction(
                url=f"{base_url}/api/embeddings",
                model_name=self.config["EMBEDDING_MODEL"],
            )
        elif provider_type == LLMProviderType.OPENAI_COMPATIBLE.value:
            self.embedding_model = OpenAIEmbeddingFunction(
                model_name=self.config["EMBEDDING_MODEL"],
                api_key=self.config.get("LLM_API_KEY") or "cant-be-empty",
                api_base=f"{base_url}/v1",
            )
        elif provider_type == LLMProviderType.LOCAL.value:
            # Use OllamaEmbeddingFunction pointing to bundled Ollama
            self.embedding_model = OllamaEmbeddingFunction(
                url="http://127.0.0.1:11434/api/embeddings",
                model_name=self.config["EMBEDDING_MODEL"],
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

    async def get_structured_response(self, messages, schema, options=None):
        """Get structured response."""
        options = config_manager.get_prompts_and_options()["options"]["general"]

        response_json = await self.llm_client.chat_with_structured_output(
            model=self.config["PRIMARY_MODEL"],
            messages=messages,
            schema=schema,
            options=options,
        )
        return response_json

    def commit_to_vectordb(
        self, disease_name, focus_area, document_source, filename
    ):
        """
        Commits extracted text to the vector database.
        """
        try:
            if self.extracted_text_store is None:
                raise ValueError(
                    "Extracted text not available. Please extract the PDF information first."
                )

            logger.info(
                "Committing to vectordb: disease=%s focus_area=%s source=%s filename=%s",
                disease_name,
                focus_area,
                document_source,
                filename,
            )

            chunker = ClusterSemanticChunker(
                embedding_function=self.embedding_model,
                max_chunk_size=500,
                min_chunk_size=150,
            )

            texts = chunker.split_text(self.extracted_text_store)
            logger.info("Chunking complete: %d chunks produced", len(texts))

            collection = self.chroma_client.get_or_create_collection(
                name=disease_name,
                embedding_function=self.embedding_model,
                metadata={"hnsw:space": "cosine"},
            )
            logger.debug("Using Chroma collection: %s", disease_name)

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
            logger.info("Documents successfully added: %d", len(texts))

        except Exception:
            logger.exception(
                "Failed to commit to vectordb (disease=%s, filename=%s)",
                disease_name,
                filename,
            )

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
            list: List of collection names (strings).
        """
        try:
            collections = self.chroma_client.list_collections()
            print(f"Collections:{collections}")
            collection_names = [collection.name for collection in collections]
            return sorted(collection_names)
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

    def reset_database(self):
        """
        Resets the entire Chroma persistent database.

        Returns:
            bool: True if reset was successful, False otherwise.
        """
        try:
            # Requires `allow_reset=True` in Chroma Settings (configured in __init__).
            self.chroma_client.reset()
            self.extracted_text_store = None
            return True
        except Exception as e:
            print(f"Error resetting database: {e}")
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
            Text (str): Extracted text from the document.

        Returns:
                str: Determined disease name.
        """
        from server.schemas.grammars import DiseaseNameResponse

        collection_names = [
            c.name for c in self.chroma_client.list_collections()
        ]
        collection_names_string = ", ".join(collection_names)

        words = text.split()
        sample_text = " ".join(words[:500])

        disease_question_options = {
            **prompts["options"]["chat"],  # Unpack the chat options
        }
        disease_question_options["stop"] = [".", " "]

        # JSON schema instruction for flaky endpoints
        json_schema_instruction = (
            "Output MUST be ONLY valid JSON with top-level key "
            '"disease_name" (string). Example: '
            + json.dumps({"disease_name": "..."})
        )

        # Initial disease question messages
        disease_messages = [
            {
                "role": "system",
                "content": self.prompts["prompts"]["chat"]["system"]
                + "\n\n"
                + json_schema_instruction,
            },
            {
                "role": "user",
                "content": f"""Analyze this text sample and determine the disease it discusses:

                Text: {sample_text}

                Available collections: {collection_names_string}

                If the text primarily relates to one of the available collections, use that exact name.
                Otherwise, identify the main disease discussed in American English (no acronyms).
                Provide the disease name in lowercase with underscores instead of spaces.""",
            },
        ]

        disease_response = await self.get_structured_response(
            disease_messages, DiseaseNameResponse.model_json_schema()
        )

        disease_data = DiseaseNameResponse.model_validate_json(disease_response)

        return disease_data.disease_name

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

        # JSON schema instruction for flaky endpoints
        json_schema_instruction = (
            "Output MUST be ONLY valid JSON with top-level key "
            '"focus_area" (string). Example: '
            + json.dumps({"focus_area": "..."})
        )

        # Focus area determination
        focus_area_messages = [
            {
                "role": "system",
                "content": self.prompts["prompts"]["chat"]["system"]
                + "\n\n"
                + json_schema_instruction,
            },
            {
                "role": "user",
                "content": f"""Analyze this text and determine its primary focus area:

                Text: {sample_text}

                Choose the most appropriate focus area from: guidelines, diagnosis, treatment, epidemiology, pathophysiology, prognosis, clinical_features, prevention, or miscellaneous.

                Provide the focus area in lowercase with underscores instead of spaces.""",
            },
        ]

        focus_response = await self.get_structured_response(
            focus_area_messages, FocusAreaResponse.model_json_schema()
        )

        focus_data = FocusAreaResponse.model_validate_json(focus_response)

        return focus_data.focus_area

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

        # JSON schema instruction for flaky endpoints
        json_schema_instruction = (
            "Output MUST be ONLY valid JSON with top-level key "
            '"source" (string). Example: ' + json.dumps({"source": "..."})
        )

        # Document source determination
        source_messages = [
            {
                "role": "system",
                "content": self.prompts["prompts"]["chat"]["system"]
                + "\n\n"
                + json_schema_instruction,
            },
            {
                "role": "user",
                "content": f"""Identify the source of this document:

                Text: {sample_text}

                Available sources: {existing_sources_string}

                If the document matches one of the available sources, use that exact name.
                Otherwise, provide the actual source name of the document.
                Provide the source in lowercase with underscores instead of spaces.""",
            },
        ]

        source_response = await self.get_structured_response(
            source_messages, DocumentSourceResponse.model_json_schema()
        )

        source_data = DocumentSourceResponse.model_validate_json(
            source_response
        )

        return source_data.source
