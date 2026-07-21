"""
Data types shared across the vector-store backend.

The VectorStoreManager delegates all storage operations to whichever backend is active.
"""

from __future__ import annotations

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
