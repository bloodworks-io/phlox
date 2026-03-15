import io
import json
import logging
import re
import threading

# Optional RAG dependencies (core)
try:
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils.embedding_functions import (
        ONNXMiniLM_L6_V2,
        OpenAIEmbeddingFunction,
    )

    from .semantic_chunker import ClusterSemanticChunker

    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    chromadb = None

try:
    from pypdf import PdfReader

    PDF_TEXT_AVAILABLE = True
except ImportError:
    PDF_TEXT_AVAILABLE = False
    PdfReader = None

# Optional OCR dependencies (fallback path for scanned PDFs)
try:
    from PIL import Image
    import fitz  # PyMuPDF for rasterization
    import pytesseract

    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    Image = None
    fitz = None
    pytesseract = None

from server.constants import DATA_DIR
from server.database.config.manager import config_manager
from server.utils.llm_client.base import LLMProviderType
from server.utils.llm_client.client import get_llm_client
from server.utils.url_utils import normalize_openai_base_url

prompts = config_manager.get_prompts_and_options()

logger = logging.getLogger(__name__)

_chroma_manager_instance = None
_chroma_lock = threading.Lock()


def get_chroma_manager():
    """Get the ChromaManager singleton."""
    global _chroma_manager_instance
    if _chroma_manager_instance is None:
        with _chroma_lock:
            if _chroma_manager_instance is None:
                if not CHROMADB_AVAILABLE:
                    return None
                _chroma_manager_instance = ChromaManager()
    return _chroma_manager_instance


class ChromaManager:
    """
    Manages interactions with the Chroma vector database for document storage and retrieval.
    """

    def __init__(self):
        """
        Initializes the ChromaManager with configuration settings and clients.
        """
        if not CHROMADB_AVAILABLE:
            raise RuntimeError("RAG features require chromadb.")

        self.config = config_manager.get_config()
        self.prompts = config_manager.get_prompts_and_options()

        self.chroma_client = chromadb.PersistentClient(
            path=str(DATA_DIR / "chroma"),
            settings=Settings(anonymized_telemetry=False, allow_reset=True),
        )
        self.extracted_text_store = None

        self._reload_embedding_function()

        self.llm_client = get_llm_client()

    def _reload_embedding_function(self):
        """Reload the embedding function with fresh config.

        This is called on init and can be called again when config changes.
        Follows the same pattern as database connection refresh.
        """
        self.config = config_manager.get_config()

        # Initialize embedding function based on provider type
        provider_type = self.config.get("LLM_PROVIDER", "openai").lower()

        # Normalize configured base URL and allow optional '/v1' in user input.
        raw_base_url = self.config.get("LLM_BASE_URL") or "http://127.0.0.1:11434"
        base_url = normalize_openai_base_url(raw_base_url)

        if provider_type == LLMProviderType.OPENAI_COMPATIBLE.value:
            self.embedding_model = OpenAIEmbeddingFunction(
                model_name=self.config["EMBEDDING_MODEL"],
                api_key=self.config.get("LLM_API_KEY") or "cant-be-empty",
                api_base=f"{base_url}/v1",
            )
        elif provider_type == LLMProviderType.LOCAL.value:
            # Use Chroma's built-in ONNX embedding function (local only)
            self.embedding_model = ONNXMiniLM_L6_V2()
        else:
            raise ValueError(f"Unsupported LLM provider type: {provider_type}")

        logger.info(
            f"Reloaded embedding function: provider={provider_type}, "
            f"model={self.config.get('EMBEDDING_MODEL', 'N/A')}"
        )

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

    def commit_to_vectordb(self, disease_name, focus_area, document_source, filename):
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
            context = collection.get(where={"disease_name": formatted_name}, include=["metadatas"])
            unique_ids = {re.sub(r"_\d*", "", id_) for id_ in context["ids"]}
            return list(unique_ids)
        except Exception as e:
            print(f"Error retrieving files for collection '{collection_name}':", e)
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
            result = collection.get(where={"disease_name": formatted_name}, include=["metadatas"])
            ids_to_delete = [id for id in result["ids"] if re.sub(r"_\d*$", "", id) == file_name]
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
            print(f"Error deleting file from collection '{collection_name}': {e}")
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
            print(f"Collection '{old_name_formatted}' renamed to '{new_name_formatted}'")
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

        Prefer text-layer extraction via pypdf.
        If extracted text is insufficient, fallback to OCR if available.

        Args:
            pdf_path (str): Path to the PDF file.

        Returns:
            str: Extracted text from the PDF.
        """

        def _is_text_usable(text: str) -> bool:
            normalized = (text or "").strip()
            if len(normalized) < 120:
                return False
            alnum_count = sum(1 for ch in normalized if ch.isalnum())
            return alnum_count >= 80

        pdf_bytes = b""
        with open(pdf_path, "rb") as pdf_file:
            pdf_bytes = pdf_file.read()

        text_layer_output = ""

        if PDF_TEXT_AVAILABLE:
            try:
                reader = PdfReader(io.BytesIO(pdf_bytes))
                text_parts = []
                for page in reader.pages:
                    text_parts.append(page.extract_text() or "")
                text_layer_output = "\n\n".join(text_parts).strip()
            except Exception as e:
                logger.warning("Failed text-layer extraction for '%s': %s", pdf_path, e)
                text_layer_output = ""

        if _is_text_usable(text_layer_output):
            return text_layer_output

        # OCR fallback for scanned/image-based PDFs (typically Docker deployments
        # where OCR dependencies are installed and no visual model is configured).
        if OCR_AVAILABLE:
            try:
                ocr_texts = []
                document = fitz.open(stream=pdf_bytes, filetype="pdf")
                for page_num in range(document.page_count):
                    page = document[page_num]
                    pix = page.get_pixmap()
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    ocr_texts.append(pytesseract.image_to_string(img))
                ocr_output = "\n\n".join(ocr_texts).strip()

                if _is_text_usable(ocr_output):
                    return ocr_output

                # If OCR ran but still weak, return best available output.
                if ocr_output:
                    return ocr_output
            except Exception as e:
                logger.warning("OCR fallback failed for '%s': %s", pdf_path, e)

        # Return partial text-layer output if that's all we have.
        if text_layer_output:
            return text_layer_output

        raise RuntimeError(
            "Could not extract usable PDF text. Install pypdf and/or "
            "PyMuPDF + Pillow + pytesseract for OCR fallback."
        )

    async def get_disease_name(self, text):
        """
        Determines the disease name from the extracted text.

        Args:
            Text (str): Extracted text from the document.

        Returns:
                str: Determined disease name.
        """
        from server.schemas.grammars import DiseaseNameResponse

        collection_names = [c.name for c in self.chroma_client.list_collections()]
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
            '"disease_name" (string). Example: ' + json.dumps({"disease_name": "..."})
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
            '"focus_area" (string). Example: ' + json.dumps({"focus_area": "..."})
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

        source_data = DocumentSourceResponse.model_validate_json(source_response)

        return source_data.source
