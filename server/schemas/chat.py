from typing import Any

from pydantic import BaseModel


class Message(BaseModel):
    """
    Represents a single message in a chat conversation.

    Attributes:
        role (str): The role of the message sender (e.g., 'user', 'assistant').
        content (str): The content of the message.
    """

    role: str
    content: str


class PatientContext(BaseModel):
    """
    Represents patient context for chat interactions.

    Attributes:
        name (str): Patient name.
        dob (str): Patient date of birth in 'YYYY-MM-DD' format.
        ur_number (str): Patient UR number.
        encounter_date (str | None): Date of the encounter in 'YYYY-MM-DD' format.
        template_data (dict | None): Template data containing patient notes.
        template_fields (list | None): List of template field definitions.
    """

    name: str
    dob: str
    ur_number: str
    encounter_date: str | None = None
    template_data: dict[str, Any] | None = None
    template_fields: list[dict[str, Any]] | None = None


class ChatRequest(BaseModel):
    """
    Represents a request for a chat interaction.

    Attributes:
        messages (List[dict]): A list of message dictionaries, each containing 'role' and 'content'.
        raw_transcription (Optional[str]): Raw transcription data, if available.
        patient_context (Optional[PatientContext]): Patient context for building system message.
    """

    messages: list[dict]
    raw_transcription: str | None = None
    patient_context: PatientContext | None = None


class ChatResponse(BaseModel):
    """
    Represents the response from a chat interaction.

    Attributes:
        message (str): The response message content.
        context (dict, optional): Additional context information, if any.
    """

    message: str
    context: dict = None
