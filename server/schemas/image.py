"""Image processing schemas."""

from pydantic import BaseModel


class ImageUploadResponse(BaseModel):
    """Response from image upload/processing endpoint."""

    text: str
    content_type: str
    filename: str


class PatientSearchRequest(BaseModel):
    """Request for searching patients."""

    name: str | None = None
    ur_number: str | None = None
    dob: str | None = None
    encounter_date: str | None = None
    limit: int = 10
