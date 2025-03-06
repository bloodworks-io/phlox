import fitz  # PyMuPDF
from .semantic_chunker import ClusterSemanticChunker
import chromadb
from chromadb.config import Settings
from chromadb.utils.embedding_functions import OllamaEmbeddingFunction
import re
from ollama import Client as ollamaClient
from server.database.config import config_manager

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
        self.embedding_model = OllamaEmbeddingFunction(
            url=f"{self.config['OLLAMA_BASE_URL']}/api/embeddings",
            model_name=self.config["EMBEDDING_MODEL"],
        )
        self.ollama_client = ollamaClient(host=self.config["OLLAMA_BASE_URL"])
        self.chroma_client = chromadb.PersistentClient(
            path="/usr/src/app/data/chroma",
            settings=Settings(anonymized_telemetry=False, allow_reset=True),
        )
        self.extracted_text_store = None

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
                name=disease_name, embedding_function=self.embedding_model, metadata={"hnsw:space": "cosine"}
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
            collection = self.chroma_client.get_collection(name=formatted_name,
            embedding_function=self.embedding_model)
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
            collection = self.chroma_client.get_collection(name=formatted_name,
            embedding_function=self.embedding_model)
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

    def get_disease_name(self, text):
        """
        Determines the disease name from the extracted text.

        Args:
            text (str): Extracted text from the document.

        Returns:
            str: Determined disease name.
        """
        collection_names = self.chroma_client.list_collections()
        collection_names_string = ", ".join(collection_names)

        words = text.split()
        sample_text = " ".join(words[:500])

        disease_question_options = {
            **prompts["options"]["chat"],  # Unpack the chat options
            "stop": [".", "(", "\n", "/"],  # Add the stop tokens
        }

        disease_question = self.ollama_client.chat(
            model=self.config["PRIMARY_MODEL"],
            messages=[
                {
                    "role": "system",
                    "content": self.prompts["prompts"]["chat"]["system"],
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nIs the above block of specifically addressing any of the following list of diseases? {collection_names_string}\nAnswer Yes or No.",
                },
            ],
            options=disease_question_options,
        )

        disease_answer = disease_question["message"]["content"].strip()
        sanitized_disease_answer = disease_answer.lower().replace(" ", "_")

        if sanitized_disease_answer == "yes":
            disease_choice = self.ollama_client.chat(
                model=self.config["PRIMARY_MODEL"],
                messages=[
                    {
                        "role": "system",
                        "content": self.prompts["prompts"]["chat"]["system"],
                    },
                    {
                        "role": "user",
                        "content": f"{sample_text}\n\nIs the above block of text *primarily* related to any of the following list of diseases? {collection_names_string}\nAnswer Yes or No.",
                    },
                    {
                        "role": "assistant",
                        "content": "Yes",
                    },
                    {
                        "role": "user",
                        "content": f"Here is the list again:\n{collection_names_string}\nRespond only with the disease name as it appears in that list.",
                    },
                    {"role": "assistant", "content": "The disease is:"},
                ],
                options=disease_question_options,
            )
            disease_choice_response = disease_choice["message"][
                "content"
            ].strip()
            disease_name = disease_choice_response.lower().replace(" ", "_")
        else:
            disease_choice = self.ollama_client.chat(
                model=self.config["PRIMARY_MODEL"],
                messages=[
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
                        "content": f"{sample_text}\n\nWhat is the disease that the above block of text is referring to? Answer only with the name of the disease in American English, do not use acronyms. If there is more than one disease, then respond with only the name of the main disease of the text.",
                    },
                    {"role": "assistant", "content": "The disease is:"},
                ],
                options=disease_question_options,
            )
            disease_choice_response = disease_choice["message"][
                "content"
            ].strip()
            disease_name = disease_choice_response.lower().replace(" ", "_")

        return disease_name

    def get_focus_area(self, text):
        """
        Determines the focus area of the document.

        Args:
            text (str): Extracted text from the document.

        Returns:
            str: Determined focus area.
        """
        words = text.split()
        sample_text = " ".join(words[:500])

        disease_question_options = {
            **prompts["options"]["chat"],  # Unpack the chat options
            "stop": [".", "(", "\n", "/"],  # Add the stop tokens
        }

        focus_area_response = self.ollama_client.chat(
            model=self.config["PRIMARY_MODEL"],
            messages=[
                {
                    "role": "system",
                    "content": self.prompts["prompts"]["chat"]["system"],
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nIs the block of text focused on guidelines, diagnosis, treatment, epidemiology, pathophysiology, prognosis, clinical features, prevention, or miscellaneous? (answer only with one word)",
                },
            ],
            options=disease_question_options,
        )
        focus_area = (
            focus_area_response["message"]["content"]
            .strip()
            .lower()
            .replace(" ", "_")
        )
        return focus_area

    def get_document_source(self, text):
        """
        Determines the source of the document.

        Args:
            text (str): Extracted text from the document.

        Returns:
            str: Determined document source.
        """
        words = text.split()
        sample_text = " ".join(words[:250])

        existing_sources = self.list_sources_from_all_collections()
        existing_sources_string = ", ".join(existing_sources)

        disease_question_options = {
            **prompts["options"]["chat"],  # Unpack the chat options
            "stop": [".", "(", "\n", "/"],  # Add the stop tokens
        }

        document_source_question = self.ollama_client.chat(
            model=self.config["PRIMARY_MODEL"],
            messages=[
                {
                    "role": "system",
                    "content": self.prompts["prompts"]["chat"]["system"],
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nIs the source of this document one of the following? {existing_sources_string}\nAnswer Yes or No.",
                },
            ],
            options=disease_question_options,
        )
        source_answer = (
            document_source_question["message"]["content"].strip().lower()
        )

        if source_answer == "yes":
            document_source_choice = self.ollama_client.chat(
                model=self.config["PRIMARY_MODEL"],
                messages=[
                    {
                        "role": "system",
                        "content": self.prompts["prompts"]["chat"]["system"],
                    },
                    {
                        "role": "user",
                        "content": f"{sample_text}\n\nWhich of the following sources is this document from? {existing_sources_string}\nRespond only with the source name as it appears in that list.",
                    },
                    {"role": "assistant", "content": "The source is:"},
                ],
                options=disease_question_options,
            )
            document_source = (
                document_source_choice["message"]["content"]
                .strip()
                .lower()
                .replace(" ", "_")
            )
        else:
            document_source_response = self.ollama_client.chat(
                model=self.config["PRIMARY_MODEL"],
                messages=[
                    {
                        "role": "system",
                        "content": self.prompts["prompts"]["chat"]["system"],
                    },
                    {
                        "role": "user",
                        "content": f"{sample_text}\n\nWhat is the source of this document? Only give the name, no other commentary.",
                    },
                ],
                options=disease_question_options,
            )
            document_source = (
                document_source_response["message"]["content"]
                .strip()
                .lower()
                .replace(" ", "_")
            )

        return document_source

    def reset_database(self):
        """
        Completely resets the Chroma database.

        Returns:
            bool: True if reset was successful, False otherwise.
        """
        try:
            # First delete all collections individually
            collections = self.list_collections()
            for collection in collections:
                self.delete_collection(collection)

            # Then reset the entire Chroma client
            self.chroma_client.reset()
            print("Chroma database reset successfully")
            return True
        except Exception as e:
            print(f"Error resetting Chroma database: {e}")
            return False
