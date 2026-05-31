from pydantic import BaseModel, Field


# RAG Chat Items:
class ClinicalSuggestion(BaseModel):
    question: str


class ClinicalSuggestionList(BaseModel):
    suggestions: list[ClinicalSuggestion]


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

    key_points: list[str] = Field(
        description="Individual discussion points extracted from the transcript"
    )


class MultiFieldResponse(BaseModel):
    """
    Structured model for processing multiple template fields in a single LLM call.
    Each field key maps to its extracted key points.
    """

    field_summaries: dict[str, list[str]] = Field(
        description="Dictionary mapping field_key to list of extracted discussion points"
    )


class RefinedResponse(BaseModel):
    """
    Structured model where each individual discussion point
    is in its own entry in the list.
    """

    key_points: list[str]


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
class ReasoningItem(BaseModel):
    """A clinical reasoning suggestion with justification."""

    suggestion: str = Field(description="The main suggestion or finding")
    rationale: list[str] = Field(description="1-2 brief bullet points justifying this suggestion")
    critical: bool = Field(
        default=False,
        description="Set to true ONLY for potentially fatal or serious misses that require immediate attention",
    )


class ClinicalReasoning(BaseModel):
    thinking: str
    summary: str
    differentials: list[ReasoningItem]
    investigations: list[ReasoningItem]
    clinical_considerations: list[ReasoningItem]
    citations: list[str] = Field(
        default_factory=list,
        description="Tool citations from sources used in reasoning (PubMed, Wikipedia, etc.)",
    )


# Letter
class LetterDraft(BaseModel):
    """
    Structured model for letter generation results.
    """

    content: str = Field(description="The complete formatted letter content ready for display")


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


class ConsolidatedInstructions(BaseModel):
    """
    Structured model for adaptive instruction consolidation results.
    """

    consolidated_instructions: list[str] = Field(
        description="3-8 clean, non-contradictory instructions after consolidation"
    )
    changes_made: list[str] = Field(
        description="Description of changes made (e.g., 'Merged instructions 3 and 5', 'Removed contradiction')"
    )
    reason: str = Field(description="Brief explanation of the consolidation approach and rationale")
