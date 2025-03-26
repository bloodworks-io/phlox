from typing import List, Literal
from pydantic import BaseModel, Field

# RAG Chat Items:
class ClinicalSuggestion(BaseModel):
    question: str


class ClinicalSuggestionList(BaseModel):
    suggestions: List[ClinicalSuggestion]

# Transcription Processing

class FieldResponse(BaseModel):
    """
    Structured model where each individual discussion point
    is in its own entry in the list.
    """
    key_points: List[str] = Field(
        description="Individual discussion points extracted from the transcript"
    )

class RefinedResponse(BaseModel):
    """
    Structured model where each individual discussion point
    is in its own entry in the list.
    """
    key_points: List[str] = Field(
        description="Individual discussion points extracted and refined as per the system prompt"
    )

class NarrativeResponse(BaseModel):
    """
    Structured model where the content is returned as a narrative paragraph.
    """
    narrative: str = Field(
        description="A narrative paragraph summarizing the content in a cohesive, flowing text"
    )

# Reasoning

class ClinicalReasoning(BaseModel):
    thinking: str
    summary: str
    differentials: List[str]
    investigations: List[str]
    clinical_considerations: List[str]

class DialogueLine(BaseModel):
    """Represents a single line of dialogue in a transcription."""
    speaker: Literal["Doctor", "Patient", "Unknown"] = Field(...,
        description="The speaker of this line (Doctor, Patient, or Unknown if uncertain)")
    text: str = Field(...,
        description="The text spoken by this speaker, preserving all medical terminology")

class DiarizedTranscript(BaseModel):
    """Represents a segment of diarized transcript with speaker identification."""
    lines: List[DialogueLine] = Field(...,
        description="The sequence of dialogue lines with identified speakers")
