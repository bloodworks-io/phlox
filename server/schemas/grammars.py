from typing import Literal

from pydantic import BaseModel, Field


# RAG Collection Management
class DocumentClassification(BaseModel):
    """
    Single-pass classification of an uploaded RAG document: disease area,
    focus area, source, and a readable title.
    """

    disease_name: str = Field(
        ..., description="Main disease in natural casing, e.g. 'Systemic AL Amyloidosis'"
    )
    focus_area: str = Field(
        ...,
        description=(
            "Document category — one of: guidelines, diagnosis, treatment, "
            "monitoring, prognosis, pathology, overview, other"
        ),
    )
    document_source: str = Field(
        ...,
        description="Publishing source in natural casing, e.g. 'NCCN Guidelines', 'EHA Consensus'",
    )
    title: str = Field(
        ...,
        description="The document's own title as it appears in the text, e.g. '2024 EHA Consensus Guidelines on AL Amyloidosis'",
    )


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
class PreviousVisitSummary(BaseModel):
    """
    Structured model for generating a summary of a patient's previous visit.
    """

    summary: str = Field(
        description="A 2-3 sentence summary of the patient's previous visit, focusing on key clinical findings and outstanding tasks"
    )


# Reasoning
class ReasoningItem(BaseModel):
    """A chart insights suggestion with justification."""

    suggestion: str = Field(description="The main suggestion or finding")
    rationale: list[str] = Field(description="1-2 brief bullet points justifying this suggestion")
    critical: bool = Field(
        default=False,
        description="Set to true for items the clinician may wish to review promptly",
    )


class ChartInsights(BaseModel):
    thinking: str
    summary: str
    differentials: list[ReasoningItem]
    investigations: list[ReasoningItem]
    clinical_considerations: list[ReasoningItem]
    citations: list[str | dict] = Field(
        default_factory=list,
        description="Tool citations from sources used in reasoning (PubMed, Wikipedia, etc.)",
    )


# Letter
class LetterDraft(BaseModel):
    """
    Structured model for letter generation results.
    """

    content: str = Field(description="The complete formatted letter content ready for display")


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


class ProposedJob(BaseModel):
    """
    A single item extracted from an encounter plan, classified as either an actionable task or a non-task reminder/context line.
    """

    text: str = Field(
        description="A clean, self-contained, imperative task string, e.g. 'Repeat FBE in 3 months'. No leading numbers or patient name."
    )
    category: Literal["action", "follow_up"] = Field(
        description="'action' = a discrete task to order/prescribe/refer/schedule/perform/communicate; 'follow_up' = a review/monitoring reminder or context that is not itself a task"
    )
    rationale: str | None = Field(
        default=None,
        description="One short clause justifying the classification.",
    )


class JobExtractionResult(BaseModel):
    """Structured result of extracting curated jobs from a plan."""

    action_items: list[ProposedJob] = Field(
        description="Actionable tasks that should become jobs/checkboxes"
    )
    excluded: list[ProposedJob] = Field(
        description="Review/follow-up/monitoring items intentionally NOT treated as tasks, shown to the clinician as promotable"
    )
