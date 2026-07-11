"""
VectorStoreManager — backend-agnostic facade for RAG.
"""

import io
import logging
import threading
from pathlib import Path

# Optional RAG dependencies (core)
try:
    from .backends.base import ChunkData, SearchResult
    from .backends.sqlite_vec import SqliteVecBackend
    from .embeddings.providers import OpenAICompatibleProvider
    from .semantic_chunker import ClusterSemanticChunker

    VECTOR_STORE_AVAILABLE = True
except ImportError:
    VECTOR_STORE_AVAILABLE = False

try:
    from pypdf import PdfReader

    PDF_TEXT_AVAILABLE = True
except ImportError:
    PDF_TEXT_AVAILABLE = False
    PdfReader = None

from server.database.config.manager import config_manager
from server.database.core.documents_db import DOCUMENTS_DB_PATH
from server.utils.llm_client.client import get_llm_client
from server.utils.url_utils import normalize_openai_base_url

prompts = config_manager.get_prompts_and_options()

logger = logging.getLogger(__name__)

_vector_store_instance = None
_vector_store_lock = threading.Lock()


def get_vector_store_manager():
    """Get the VectorStoreManager singleton."""
    global _vector_store_instance
    if _vector_store_instance is None:
        with _vector_store_lock:
            if _vector_store_instance is None:
                if not VECTOR_STORE_AVAILABLE:
                    return None
                _vector_store_instance = VectorStoreManager()
    return _vector_store_instance


class VectorStoreManager:
    """
    Mnager for vector storage and retrieval.
    """

    def __init__(self, backend: SqliteVecBackend | None = None):
        if not VECTOR_STORE_AVAILABLE:
            raise RuntimeError("RAG features require sqlite-vec.")

        self.config = config_manager.get_config()
        self.prompts = config_manager.get_prompts_and_options()
        self.extracted_text_store: str | None = None
        self.extracted_pdf_bytes: bytes | None = None

        # Initialise backend (default: sqlite-vec)
        self.backend: SqliteVecBackend = backend or SqliteVecBackend(str(DOCUMENTS_DB_PATH))

        self._reload_embedding_function()
        self.llm_client = get_llm_client()

    # Embedding function management

    def _reload_embedding_function(self):
        """Reload the embedding function with fresh config."""
        self.config = config_manager.get_config()

        raw_base_url = self.config.get("LLM_BASE_URL")
        if raw_base_url:
            base_url = normalize_openai_base_url(raw_base_url)
        else:
            from server.utils.allocated_ports import get_embedding_port

            base_url = f"http://127.0.0.1:{get_embedding_port()}"

        self.embedding_model = OpenAICompatibleProvider(
            base_url=f"{base_url}/v1",
            api_key=self.config.get("LLM_API_KEY") or "cant-be-empty",
            model_name=self.config.get("EMBEDDING_MODEL", "text-embedding-3-small"),
        )

        logger.info(
            "Reloaded embedding function: model=%s, base_url=%s",
            self.config.get("EMBEDDING_MODEL", "N/A"),
            base_url,
        )

    @property
    def _model_name(self) -> str:
        """Human-readable name of the current embedding model."""
        return self.embedding_model.model_name

    # Collection management

    @staticmethod
    def format_to_collection_name(human_readable_name: str) -> str:
        """Format a human-readable name to a collection-safe name."""
        return human_readable_name.lower().replace(" ", "_")

    def list_collections(self) -> list[str]:
        return self.backend.list_collections()

    def get_files_for_collection(self, collection_name: str) -> list[str]:
        formatted = self.format_to_collection_name(collection_name)
        return self.backend.get_files_for_collection(formatted)

    def get_files_for_collection_with_pdf_flag(self, collection_name: str) -> list[dict]:
        """Return files for a collection with a ``has_pdf`` flag per file."""
        formatted = self.format_to_collection_name(collection_name)
        return self.backend.get_files_for_collection_with_pdf_flag(formatted)

    def get_stored_pdf(self, collection_name: str, filename: str) -> bytes | None:
        """Retrieve stored PDF bytes by collection and filename."""
        formatted = self.format_to_collection_name(collection_name)
        return self.backend.get_stored_pdf(formatted, filename)

    def delete_file_from_collection(self, collection_name: str, file_name: str) -> bool:
        formatted = self.format_to_collection_name(collection_name)
        return self.backend.delete_file_from_collection(formatted, file_name)

    def update_document_metadata(
        self,
        collection_name: str,
        filename: str,
        title: str | None = None,
        source: str | None = None,
        focus_area: str | None = None,
    ) -> bool:
        """Partial update of a document's title / source / focus_area."""
        formatted = self.format_to_collection_name(collection_name)
        return self.backend.update_document_metadata(
            formatted, filename, title=title, source=source, focus_area=focus_area
        )

    def modify_collection_name(self, old_name: str, new_name: str) -> bool:
        """Rename a collection. ``new_name`` is the new display name; the
        underlying slug/PK is derived from it."""
        old_formatted = self.format_to_collection_name(old_name)
        new_formatted = self.format_to_collection_name(new_name)
        return self.backend.rename_collection(old_formatted, new_formatted, display_name=new_name)

    def delete_collection(self, name: str) -> bool:
        formatted = self.format_to_collection_name(name)
        return self.backend.delete_collection(formatted)

    def reset_database(self) -> bool:
        try:
            self.backend.reset()
            self.extracted_text_store = None
            return True
        except Exception as e:
            logger.error("Error resetting vector database: %s", e)
            return False

    def list_sources_from_all_collections(self) -> list[str]:
        return self.backend.list_sources()

    # Document commit (ingestion)

    def set_extracted_text(self, text: str) -> None:
        """Stage extracted text for the next commit."""
        self.extracted_text_store = text

    def set_extracted_pdf(self, pdf_bytes: bytes) -> None:
        """Stage raw PDF bytes for the next commit (stored if config enabled)."""
        self.extracted_pdf_bytes = pdf_bytes

    def _commit_text_impl(
        self,
        extracted_text: str,
        disease_name: str,
        focus_area: str,
        document_source: str,
        filename: str,
        title: str | None = None,
        pdf_bytes: bytes | None = None,
    ) -> None:
        """Core commit logic: chunk text, embed, and store everything."""
        logger.info(
            "Committing to vectordb: disease=%s focus_area=%s source=%s filename=%s title=%s",
            disease_name,
            focus_area,
            document_source,
            filename,
            title,
        )

        formatted = self.format_to_collection_name(disease_name)

        # Chunk the text
        chunker = ClusterSemanticChunker(
            embedding_function=self.embedding_model,
            max_chunk_size=500,
            min_chunk_size=150,
        )
        texts = chunker.split_text(extracted_text)
        logger.info("Chunking complete: %d chunks produced", len(texts))

        # Generate embeddings
        embeddings = self.embedding_model(texts)
        dim = len(embeddings[0])
        logger.info("Embeddings generated: %d vectors, dim=%d", len(embeddings), dim)

        # Ensure collection exists (display_name preserves original casing).
        self.backend.create_collection(formatted, self._model_name, dim, display_name=disease_name)

        # Store source document (include raw PDF if config enabled)
        user_settings = config_manager.get_user_settings()
        store_pdfs = user_settings.get("advanced_options", {}).get("store_original_pdfs", False)
        stored_pdf = pdf_bytes if store_pdfs else None
        if store_pdfs:
            logger.info(
                "store_original_pdfs enabled — pdf_bytes=%s", "present" if pdf_bytes else "None"
            )
        source_doc_id = self.backend.store_source_document(
            formatted, filename, extracted_text, stored_pdf, title=title
        )

        # Build chunk data objects (store natural-cased disease_name/source).
        chunks = [
            ChunkData(
                id=f"{filename}_{idx}",
                collection_name=formatted,
                source_document_id=source_doc_id,
                chunk_index=idx,
                text=text,
                disease_name=disease_name,
                focus_area=focus_area,
                source=document_source,
                filename=filename,
                embedding=embedding,
            )
            for idx, (text, embedding) in enumerate(zip(texts, embeddings, strict=True))
        ]

        self.backend.insert_chunks(chunks)
        logger.info("Documents successfully added: %d", len(texts))

    def commit_to_vectordb(
        self,
        disease_name: str,
        focus_area: str,
        document_source: str,
        filename: str,
        title: str | None = None,
    ) -> None:
        """Chunk staged text, embed, and store everything."""
        try:
            if self.extracted_text_store is None:
                raise ValueError(
                    "Extracted text not available. Please extract the PDF information first."
                )
            self._commit_text_impl(
                extracted_text=self.extracted_text_store,
                disease_name=disease_name,
                focus_area=focus_area,
                document_source=document_source,
                filename=filename,
                title=title,
                pdf_bytes=self.extracted_pdf_bytes,
            )
        except Exception:
            logger.exception(
                "Failed to commit to vectordb (disease=%s, filename=%s)",
                disease_name,
                filename,
            )

    def commit_text_to_vectordb(
        self,
        extracted_text: str,
        disease_name: str,
        focus_area: str,
        document_source: str,
        filename: str,
        title: str | None = None,
        pdf_bytes: bytes | None = None,
    ) -> None:
        """Commit directly with extracted text (no staging required).

        Used by the bulk upload path where the frontend holds the text and
        sends it alongside the metadata in a single request.
        """
        try:
            self._commit_text_impl(
                extracted_text=extracted_text,
                disease_name=disease_name,
                focus_area=focus_area,
                document_source=document_source,
                filename=filename,
                title=title,
                pdf_bytes=pdf_bytes,
            )
        except Exception:
            logger.exception(
                "Failed to commit text directly to vectordb (disease=%s, filename=%s)",
                disease_name,
                filename,
            )

    # Similarity search

    def query_similar(self, collection_name: str, query_text: str, n_results: int = 5) -> dict:
        """Search for similar chunks in a collection."""
        formatted = self.format_to_collection_name(collection_name)
        query_embedding = self.embedding_model([query_text])[0]

        results: list[SearchResult] = self.backend.search(formatted, query_embedding, n_results)

        if not results:
            return {"documents": [[]], "metadatas": [[]], "distances": [[]]}

        documents = [r.text for r in results]
        metadatas = [r.metadata for r in results]
        distances = [r.distance for r in results]

        return {
            "documents": [documents],
            "metadatas": [metadatas],
            "distances": [distances],
        }

    # Re-embedding

    def re_embed_all(self) -> dict:
        """Re-embed all collections with the current embedding model.

        Reloads the embedding function from fresh config first, so that
        a config change (e.g. new EMBEDDING_MODEL) is picked up.

        Returns a summary dict with counts.
        """
        self._reload_embedding_function()
        collection_names = self.backend.list_collections()
        new_model = self._model_name
        new_dim = self.embedding_model.dimension
        total_re_embedded = 0

        for collection_name in collection_names:
            count = self._re_embed_collection(collection_name, new_model, new_dim)
            total_re_embedded += count
            logger.info("Re-embedded %d chunks in collection '%s'", count, collection_name)

        return {
            "collections_processed": len(collection_names),
            "total_chunks_re_embedded": total_re_embedded,
            "new_model": new_model,
            "new_dimension": new_dim,
        }

    def _re_embed_collection(self, collection_name: str, model_name: str, dim: int) -> int:
        """Re-embed a single collection. Returns the number of chunks re-embedded."""
        chunk_texts = self.backend.get_chunk_texts(collection_name)
        if not chunk_texts:
            return 0

        chunk_ids = [t[0] for t in chunk_texts]
        texts = [t[1] for t in chunk_texts]

        # Generate new embeddings in batches
        batch_size = 100
        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            all_embeddings.extend(self.embedding_model(batch))

        return self.backend.replace_embeddings(
            collection_name,
            model_name,
            dim,
            list(zip(chunk_ids, all_embeddings, strict=True)),
        )

    # PDF text extraction

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """
        Extract text from a PDF file using pypdf.
        """
        logger.info("Backend RAG PDF parser invoked for file: %s", pdf_path)

        def _is_text_usable(text: str) -> bool:
            normalized = (text or "").strip()
            if len(normalized) < 120:
                return False
            alnum_count = sum(1 for ch in normalized if ch.isalnum())
            return alnum_count >= 80

        pdf_bytes = b""
        with Path(pdf_path).open("rb") as pdf_file:
            pdf_bytes = pdf_file.read()

        text_layer_output = ""

        if PDF_TEXT_AVAILABLE:
            try:
                reader = PdfReader(io.BytesIO(pdf_bytes))  # ty: ignore
                text_parts = []
                for page in reader.pages:
                    text_parts.append(page.extract_text() or "")
                text_layer_output = "\n\n".join(text_parts).strip()
            except Exception as e:
                logger.warning("Failed text-layer extraction for '%s': %s", pdf_path, e)
                text_layer_output = ""

        if _is_text_usable(text_layer_output):
            logger.info("Backend RAG PDF parser used pypdf text-layer output")
            return text_layer_output

        if text_layer_output:
            logger.warning("Returning partial pypdf text-layer output")
            return text_layer_output

        raise RuntimeError(
            "Could not extract usable PDF text. "
            "The frontend should handle PDF text extraction via pdfjs-dist. "
            "Install pypdf as a backend fallback."
        )

    # LLM-based metadata extraction

    async def get_structured_response(self, messages, schema, options=None):
        """Get structured response from LLM."""
        options = config_manager.get_prompts_and_options()["options"]["general"]
        response_json = await self.llm_client.chat_with_structured_output(
            model=self.config["PRIMARY_MODEL"],
            messages=messages,
            schema=schema,
            options=options,
        )
        return response_json

    async def get_document_classification(self, text: str):
        """Single-pass RAG document classification."""
        from server.schemas.grammars import DocumentClassification

        collection_names = self.list_collections()
        collection_names_string = ", ".join(collection_names) or "(none yet)"
        existing_sources = self.list_sources_from_all_collections()
        existing_sources_string = ", ".join(existing_sources) or "(none yet)"

        words = text.split()
        sample_text = " ".join(words[:500])

        messages = [
            {
                "role": "system",
                "content": self.prompts["prompts"]["chat"]["system"],
            },
            {
                "role": "user",
                "content": f"""Classify this medical document in a single pass.

Text sample: {sample_text}

Return JSON with these fields:
- "disease_name": the main disease discussed, in natural written casing (e.g. "Systemic AL Amyloidosis", "Essential Thrombocythemia"). If the text clearly relates to one of these existing collections, reuse that exact name: {collection_names_string}. Otherwise identify the disease in American English (no acronyms unless universally used, e.g. "CLL" is acceptable).
- "focus_area": the document category — exactly one of: guidelines, diagnosis, treatment, epidemiology, pathophysiology, prognosis, clinical_features, prevention, miscellaneous.
- "document_source": the publishing source in natural casing (e.g. "NCCN Guidelines", "EHA Consensus", "British Society for Haematology"). If it matches an existing source, reuse that exact name: {existing_sources_string}.
- "title": the document's own title as printed in the text (e.g. "2024 EHA Consensus Guidelines on the Diagnosis and Management of AL Amyloidosis"). If no explicit title is present, write a concise descriptive title.

Use normal casing and spaces throughout (no underscores, no lowercasing).""",
            },
        ]

        response = await self.get_structured_response(
            messages, DocumentClassification.model_json_schema()
        )
        return DocumentClassification.model_validate_json(response)
