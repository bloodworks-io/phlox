from enum import Enum
from typing import Any, Literal, Union

from pydantic import BaseModel, validator

VALID_FIELD_TYPES = Literal["text", "number", "date", "boolean", "list", "structured"]


class FormatStyle(str, Enum):
    BULLETS = "bullets"
    NUMBERED = "numbered"
    NARRATIVE = "narrative"
    HEADING_WITH_BULLETS = "heading_with_bullets"
    LAB_VALUES = "lab_values"


class TemplateField(BaseModel):
    field_key: str
    field_name: str
    field_type: str
    required: bool = False
    persistent: bool = False
    system_prompt: str
    initial_prompt: str | None = None
    format_schema: dict | None = None
    style_example: str
    refinement_rules: list[str] | None = None
    adaptive_refinement_instructions: list[str] | None = None

    @validator("field_type")
    def validate_field_type(cls, v):
        valid_types = ["text", "number", "date", "boolean", "list", "structured"]
        if v not in valid_types:
            raise ValueError(f"field_type must be one of {valid_types}")
        return v


class AdaptiveRefinementRequest(BaseModel):
    initial_content: str
    modified_content: str


class ClinicalTemplate(BaseModel):
    template_key: str
    template_name: str
    fields: list[TemplateField]
    deleted: bool = False
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        extra = "allow"


class TemplateResponse(BaseModel):
    field_key: str
    content: Union[str, int, bool, list[str], dict[str, Any]]


class ProcessedTemplate(BaseModel):
    template_key: str
    fields: dict[str, Union[str, int, bool, list[str], dict[str, Any]]]
    process_duration: float


class TemplateFieldSchema(BaseModel):
    field_key: str
    field_name: str
    field_type: str = "text"
    required: bool = False
    description: str
    example_value: str | None = None


class TemplateSectionSchema(BaseModel):
    field_name: str
    format_style: FormatStyle
    bullet_type: str | None = None
    section_starter: str
    example_text: str
    system_prompt: str
    persistent: bool = False
    required: bool = False


class ExtractedTemplate(BaseModel):
    sections: list[TemplateSectionSchema]
    suggested_name: str
    note_type: str
