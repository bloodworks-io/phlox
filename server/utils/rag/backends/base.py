"""
Abstract backend interface for the vector store.

The VectorStoreManager delegates all storage operations to whichever backend is active.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ChunkData:
    """A chunk ready for storage — includes text, metadata, and embedding."""

    id: str
    collection_name: str
    source_document_id: int
    chunk_index: int
    text: str
    disease_name: str
    focus_area: str
    source: str
    filename: str
    embedding: list[float]


@dataclass
class SearchResult:
    """A single result from a similarity search."""

    chunk_id: str
    text: str
    distance: float
    metadata: dict[str, str] = field(default_factory=dict)


class VectorStoreBackend(ABC):
    """Abstract interface that every vector-store backend must implement."""

    # Collection lifecycle
    @abstractmethod
    def list_collections(self) -> list[str]:
        """Return a sorted list of collection names."""

    @abstractmethod
    def create_collection(self, name: str, embedding_model: str, embedding_dim: int) -> None:
        """Create a collection (idempotent — noop if it already exists)."""

    @abstractmethod
    def delete_collection(self, name: str) -> bool:
        """Delete a collection and all its data.  Return True on success."""

    @abstractmethod
    def rename_collection(self, old_name: str, new_name: str) -> bool:
        """Rename a collection.  Return True on success."""

    @abstractmethod
    def reset(self) -> None:
        """Wipe all data and re-initialise the schema."""

    # Document storage
    @abstractmethod
    def store_source_document(self, collection_name: str, filename: str, full_text: str) -> int:
        """Insert a source document and return its integer ID."""

    @abstractmethod
    def insert_chunks(self, chunks: list[ChunkData]) -> None:
        """Persist a batch of chunks (text + metadata + embeddings)."""

    @abstractmethod
    def get_files_for_collection(self, collection_name: str) -> list[str]:
        """Return distinct filenames in a collection."""

    @abstractmethod
    def delete_file_from_collection(self, collection_name: str, filename: str) -> bool:
        """Remove all chunks/embeddings for a file.  Return True on success."""

    # Similarity search

    @abstractmethod
    def search(
        self, collection_name: str, query_embedding: list[float], n_results: int = 5
    ) -> list[SearchResult]:
        """Return the top-N nearest chunks ordered by distance (ascending)."""

    # Re-embedding

    @abstractmethod
    def get_chunk_texts(self, collection_name: str) -> list[tuple[str, str]]:
        """Return (chunk_id, text) pairs for every chunk in a collection."""

    @abstractmethod
    def replace_embeddings(
        self,
        collection_name: str,
        model_name: str,
        dim: int,
        embeddings: list[tuple[str, list[float]]],
    ) -> int:
        """Replace all embeddings in a collection."""

    # Metadata queries

    @abstractmethod
    def list_sources(self) -> list[str]:
        """Return distinct ``source`` values across all collections."""
