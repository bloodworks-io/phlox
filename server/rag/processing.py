import fitz  # PyMuPDF
from .semantic_chunker import ClusterSemanticChunker
import chromadb
from chromadb.config import Settings
import os
import asyncio
from server.database.config import config_manager
from server.schemas.grammars import ClinicalSuggestionList
from server.utils.llm_client import get_llm_client

# Initialize ConfigManager
config = config_manager.get_config()
prompts = config_manager.get_prompts_and_options()


# Function to process all PDFs in a given directory
async def process_pdfs_in_directory(directory_path):
    """Processes all PDFs in a given directory."""
    for filename in os.listdir(directory_path):
        if filename.endswith(".pdf"):
            pdf_path = os.path.join(directory_path, filename)
            await process_single_pdf(pdf_path)

async def generate_specialty_suggestions():
    """Generate RAG chat suggestions based on user's specialty from DB."""
    try:
        # Get user settings from DB
        user_settings = config_manager.get_user_settings()
        specialty = user_settings.get("specialty", "General Practice")

        # Get config and prompts
        config = config_manager.get_config()
        prompts = config_manager.get_prompts_and_options()

        # Initialize the LLM client
        client = get_llm_client()

        suggestion_prompt = f"""As an expert in {specialty}, generate 3 brief, focused clinical questions that are 4-5 words long.

        Rules:
        - Each question MUST be 5-6 words only
        - Be specific and concise
        - Use common medical abbreviations when appropriate

        Examples of good questions:
        - "What are the ET diagnostic criteria?"
        - "Best treatment for severe sepsis?"
        - "What's the diagnostic approach for RA?"

        Format your response as structured JSON matching this schema:
        {{
            "suggestions": [
                {{
                    "question": "string",
                }}
            ]
        }}"""

        messages = [
            {
                "role": "system",
                "content": "You are a medical education assistant. Keep all responses extremely concise.",
            },
            {"role": "user", "content": suggestion_prompt},
        ]

        # Use chat_with_structured_output instead of manual chat + format
        response_json = await client.chat_with_structured_output(
            model=config["PRIMARY_MODEL"],
            messages=messages,
            schema=ClinicalSuggestionList.model_json_schema(),
            options={
                **prompts["options"]["secondary"],
                "temperature": "0.7",
            },
        )

        suggestions = ClinicalSuggestionList.model_validate_json(response_json)

        return [s.question for s in suggestions.suggestions]

        return [s.question for s in suggestions.suggestions]

    except Exception as e:
        print(f"Error generating suggestions: {str(e)}")
        return [
            "How to diagnose lupus?",
            "Best treatment for pneumonia?",
            "When to start antibiotics?",
        ]
