from typing import Any

from pydantic import BaseModel, Field


class Patient(BaseModel):
    """
    Represents a patient's medical record with template support.
    """

    id: int | None = None
    name: str
    dob: str | None = None
    ur_number: str | None = None
    gender: str | None = None
    encounter_date: str
    template_key: str | None = None
    template_data: dict[str, Any] | None = None
    raw_transcription: str | None = None
    transcription_duration: float | None = None
    process_duration: float | None = None
    primary_condition: str | None = None
    final_letter: str | None = None
    encounter_summary: str | None = None

    class Config:
        arbitrary_types_allowed = True


class AdaptiveRefinementData(BaseModel):
    """
    Represents adaptive refinement data for a specific field.
    """

    initial_content: str
    modified_content: str


class SavePatientRequest(BaseModel):
    """
    Represents a request to save patient data.

    Attributes:
        patientData (Patient): Patient data to be saved
    """

    patientData: Patient
    adaptive_refinement: dict[str, AdaptiveRefinementData] | None = None

    class Config:
        arbitrary_types_allowed = True


class TranscribeResponse(BaseModel):
    """
    Represents the response from a transcription process.

    Attributes:
        fields (Dict[str, Any]): Processed template fields
        rawTranscription (str): Raw transcription text
        transcriptionDuration (float): Time taken for transcription
        processDuration (float): Time taken for processing
    """

    fields: dict[str, Any]
    rawTranscription: str
    transcriptionDuration: float
    processDuration: float

    class Config:
        arbitrary_types_allowed = True


class Job(BaseModel):
    """
    Represents a single job/task for a patient.

    Attributes:
        id (int): Unique identifier for the job
        job (str): Description of the job
        completed (bool): Completion status of the job
    """

    id: int
    job: str
    completed: bool


class JobsListUpdate(BaseModel):
    """
    Represents an update to a patient's jobs list.

    Attributes:
        patientId (int): Unique identifier of the patient
        jobsList (List[Job]): List of jobs for the patient
    """

    patientId: int
    jobsList: list[Job]


class DocumentProcessResponse(BaseModel):
    """
    Represents the response from document processing.

    Attributes:
        primaryHistory (str): Processed primary history
        additionalHistory (str): Processed additional history
        investigations (str): Processed investigations
        processDuration (float): Time taken for processing
    """

    primaryHistory: str
    additionalHistory: str
    investigations: str
    processDuration: float


class Condition(BaseModel):
    """
    Represents a medical condition with constrained choices.
    """

    condition_name: str = Field(..., description="The primary medical condition")
    is_new_condition: bool = Field(
        False, description="Whether this is a new condition not in the existing list"
    )


class Summary(BaseModel):
    """
    Summary of the medical encounter.

    Attributes:
        summary_text (str): Summary text of the encounter
    """

    summary_text: str


class TemplateData(BaseModel):
    """
    Represents template data for a patient encounter.
    """

    field_key: str
    content: Any
