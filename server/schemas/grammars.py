from pydantic import BaseModel, Field
from typing import List

# RAG Chat Items:
class ClinicalSuggestion(BaseModel):
    question: str

class ClinicalSuggestionList(BaseModel):
    suggestions: List[ClinicalSuggestion]

# RAG Collection Management
class DiseaseNameResponse(BaseModel):
    """
    Structured model for disease name identification.
    """
    disease_name: str

class FocusAreaResponse(BaseModel):
    """
    Structured model for document focus area.
    """
    focus_area: str

class DocumentSourceResponse(BaseModel):
    """
    Structured model for document source identification.
    """
    source: str

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
    key_points: List[str]

class NarrativeResponse(BaseModel):
    """
    Structured model where the content is returned as a narrative paragraph.
    """
    narrative: str = Field(
        description="A narrative paragraph summarizing the content in a cohesive, flowing text"
    )

# Patient Analysis
class PatientAnalysis(BaseModel):
    """
    Structured model for generating a patient analysis digest.
    """
    analysis: str = Field(
        description="A concise 3-4 sentence narrative digest of the most pressing patient tasks that need attention"
    )

class PreviousVisitSummary(BaseModel):
    """
    Structured model for generating a summary of a patient's previous visit.
    """
    summary: str = Field(
        description="A 2-3 sentence summary of the patient's previous visit, focusing on key clinical findings and outstanding tasks"
    )

# Reasoning
class ClinicalReasoning(BaseModel):
    thinking: str
    summary: str
    differentials: List[str]
    investigations: List[str]
    clinical_considerations: List[str]

# Letter
class LetterDraft(BaseModel):
    """
    Structured model for letter generation results.
    """
    content: str = Field(
        description="The complete formatted letter content ready for display"
    )

# RSS News Digests
class ItemDigest(BaseModel):
    """
    Structured model for individual RSS item digest.
    """
    digest: str = Field(
        description="A 1-2 sentence summary highlighting the key finding or clinical implication of the article"
    )

class NewsDigest(BaseModel):
    """
    Structured model for combined news digest.
    """
    digest: str = Field(
        description="A concise 3-4 sentence digest summarizing multiple medical news articles with focus on clinical implications"
    )
