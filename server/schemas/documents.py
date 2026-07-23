"""Schemas for document / vision processing"""

from pydantic import BaseModel


class VisualDocumentPage(BaseModel):
    """A single rendered page of a document (image or PDF) sent for vision analysis."""

    page_number: int
    data_url: str
    mime_type: str | None = None
    width: int | None = None
    height: int | None = None
