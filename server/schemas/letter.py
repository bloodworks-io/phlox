from datetime import datetime

from pydantic import BaseModel


class LetterTemplate(BaseModel):
    """
    Represents a letter template.

    Attributes:
        id (Optional[int]): Template ID
        name (str): Template name
        instructions (str): Instructions for letter generation
        created_at (Optional[datetime]): Creation timestamp
    """

    id: int | None = None
    name: str
    instructions: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class LetterRequest(BaseModel):
    """
    Represents a request to generate a letter.

    Attributes:
        patientName (str): Name of the patient
        gender (str): Patient's gender
        template_data (dict): Template data
        additional_instruction (Optional[str]): Additional instructions for letter generation
    """

    patientName: str
    gender: str
    dob: str
    template_data: dict
    additional_instruction: str | None = None
    context: list[dict[str, str]] | None = None


class LetterSave(BaseModel):
    """
    Represents a request to save a generated letter.

    Attributes:
        patientId (int): Unique identifier of the patient
        letter (str): Content of the letter to be saved
    """

    patientId: int
    letter: str
