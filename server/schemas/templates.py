from pydantic import BaseModel, Field, validator
from typing import List, Optional, Union, Literal, Dict, Any
from enum import Enum

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
    initial_prompt: str
    format_schema: Optional[dict] = None
    refinement_rules: Optional[List[str]] = None

    @validator('field_type')
    def validate_field_type(cls, v):
        valid_types = ["text", "number", "date", "boolean", "list", "structured"]
        if v not in valid_types:
            raise ValueError(f"field_type must be one of {valid_types}")
        return v

class ClinicalTemplate(BaseModel):
    template_key: str
    template_name: str
    fields: List[TemplateField]
    deleted: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        extra = "allow"

class TemplateResponse(BaseModel):
    field_key: str
    content: Union[str, int, bool, List[str], Dict[str, Any]]

class ProcessedTemplate(BaseModel):
    template_key: str
    fields: Dict[str, Union[str, int, bool, List[str], Dict[str, Any]]]
    process_duration: float

class TemplateFieldSchema(BaseModel):
    field_key: str
    field_name: str
    field_type: str = "text"
    required: bool = False
    description: str
    example_value: Optional[str] = None

class TemplateSectionSchema(BaseModel):
    field_name: str
    format_style: FormatStyle
    bullet_type: Optional[str] = None
    section_starter: str
    persistent: bool = False
    required: bool = False

class ExtractedTemplate(BaseModel):
    sections: List[TemplateSectionSchema]
    suggested_name: str
    note_type: str
