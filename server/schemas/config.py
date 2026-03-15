from pydantic import BaseModel, Field


class Config(BaseModel):
    """
    Configuration model for the application.

    Attributes:
        LLM_PROVIDER (str): LLM provider type ("openai" for OpenAI-compatible APIs, or "local").
        LLM_BASE_URL (str): Base URL for the OpenAI-compatible LLM endpoint.
        LLM_API_KEY (str): API key for the LLM endpoint (optional depending on provider).
        PRIMARY_MODEL (str): Primary model used for core generation tasks.
        SECONDARY_MODEL (str): Secondary model used for alternate generation tasks.
        EMBEDDING_MODEL (str): Model used for embedding generation.
        WHISPER_BASE_URL (str): Base URL for Whisper-compatible transcription endpoint.
        WHISPER_MODEL (str): Whisper model identifier.
        WHISPER_KEY (str): API key for Whisper endpoint (optional depending on provider).
        REASONING_MODEL (str): Model used for reasoning/analysis tasks.
        REASONING_ENABLED (bool): Toggle to enable or disable reasoning features.
        DAILY_SUMMARY (str): Optional daily summary configuration/prompt value.
    """

    LLM_PROVIDER: str = Field(default="openai")
    LLM_BASE_URL: str = Field(default="")
    LLM_API_KEY: str = Field(default="")

    PRIMARY_MODEL: str = Field(default="")
    SECONDARY_MODEL: str = Field(default="")
    EMBEDDING_MODEL: str = Field(default="")

    WHISPER_BASE_URL: str = Field(default="")
    WHISPER_MODEL: str = Field(default="")
    WHISPER_KEY: str = Field(default="")

    REASONING_MODEL: str = Field(default="")
    REASONING_ENABLED: bool = Field(default=False)

    DAILY_SUMMARY: str = Field(default="")


class ConfigData(BaseModel):
    """
    Container for configuration data.

    This model is used to wrap configuration data in a dictionary format.

    Attributes:
        data (dict): A dictionary containing configuration key-value pairs.
    """

    data: dict
