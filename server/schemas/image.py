"""Image processing schemas."""

from typing import Optional
from pydantic import BaseModel


class ImageUploadResponse(BaseModel):
    """Response from image upload/processing endpoint."""

    text: str
    content_type: str
    filename: str


class PatientSearchRequest(BaseModel):
    """Request for searching patients."""

    name: Optional[str] = None
    ur_number: Optional[str] = None
    dob: Optional[str] = None
    encounter_date: Optional[str] = None
    limit: int = 10
