from pydantic import BaseModel
from typing import List, Optional

class Message(BaseModel):
    """
    Represents a single message in a chat conversation.

    Attributes:
        role (str): The role of the message sender (e.g., 'user', 'assistant').
        content (str): The content of the message.
    """
    role: str
    content: str

class ChatRequest(BaseModel):
    """
    Represents a request for a chat interaction.

    Attributes:
        messages (List[dict]): A list of message dictionaries, each containing 'role' and 'content'.
        raw_transcription (Optional[str]): Raw transcription data, if available.
    """
    messages: List[dict]
    raw_transcription: Optional[str] = None

class ChatResponse(BaseModel):
    """
    Represents the response from a chat interaction.

    Attributes:
        message (str): The response message content.
        context (dict, optional): Additional context information, if any.
    """
    message: str
    context: dict = None
