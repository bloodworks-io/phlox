"""Pydantic schemas for PDF form template endpoints."""

from pydantic import BaseModel, Field


class FieldDefinition(BaseModel):
    """A single form field definition with position and type."""

    name: str
    description: str = ""
    field_type: str = Field(default="text", pattern=r"^(text|checkbox|date|number)$")
    required: bool = False
    page_number: int = Field(ge=1)
    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    font_size: int = Field(default=12, ge=6, le=72)


class UpdateFieldsRequest(BaseModel):
    """Request body for updating all fields on a template."""

    fields: list[FieldDefinition]


class FillFormRequest(BaseModel):
    """Request body for filling a form (chat tool use)."""

    template_id: str
    field_values: dict[str, str]


class DetectFieldsPage(BaseModel):
    """A single page image with grid overlay for VLM field detection."""

    page_number: int
    data_url: str


class DetectFieldsRequest(BaseModel):
    """Request body for VLM-based auto field detection."""

    pages: list[DetectFieldsPage]
