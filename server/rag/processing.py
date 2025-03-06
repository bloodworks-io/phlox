import fitz  # PyMuPDF
from .semantic_chunker import ClusterSemanticChunker
import chromadb
from chromadb.config import Settings
import os
from ollama import Client as ollamaClient
from server.database.config import config_manager
from server.schemas.grammars import ClinicalSuggestionList

# Initialize ConfigManager
config = config_manager.get_config()
prompts = config_manager.get_prompts_and_options()


# Function to process all PDFs in a given directory
def process_pdfs_in_directory(directory_path):
    """Processes all PDFs in a given directory."""
    for filename in os.listdir(directory_path):
        if filename.endswith(".pdf"):
            pdf_path = os.path.join(directory_path, filename)
            process_single_pdf(pdf_path)


def extract_pdf_information(pdf_path):
    """Extracts information from a PDF given its path."""
    global extracted_text_store
    extracted_text_store = None
    filename = os.path.basename(pdf_path)
    extracted_text = extract_text_from_pdf(pdf_path)
    extracted_text_store = extracted_text

    collection_names = chroma_client.list_collections()
    collection_names_string = ", ".join(collection_names)

    words = extracted_text.split()
    sample_text = " ".join(words[:500])

    disease_question_options = {
        **prompts["options"]["chat"],  # Unpack the chat options
        "stop": [".", "(", "\n", "/"],  # Add the stop tokens
    }

    disease_question = client.chat(
        model=config["PRIMARY_MODEL"],
        messages=[
            {
                "role": "system",
                "content": prompts["prompts"]["chat"]["system"],
            },
            {
                "role": "user",
                "content": f"{sample_text}\n\nIs the above block of specifically addressing any of the following list of diseases? {collection_names_string}\nAnswer Yes or No.",
            },
        ],
        options=disease_question_options,
    )

    disease_answer = disease_question["message"]["content"].strip()
    sanitized_disease_answer = disease_answer.lower().replace(" ", "_")

    if sanitized_disease_answer == "yes":
        disease_choice = client.chat(
            model=config["PRIMARY_MODEL"],
            messages=[
                {
                    "role": "system",
                    "content": prompts["prompts"]["chat"]["system"],
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nIs the above block of text *primaryily* related to any of the following list of diseases? {collection_names_string}\nAnswer Yes or No.",
                },
                {
                    "role": "assistant",
                    "content": "Yes",
                },
                {
                    "role": "user",
                    "content": f"Here is the list again:\n{collection_names_string}\nRespond only with the disease name as it appears in that list.",
                },
                {"role": "assistant", "content": "The disease is:"},
            ],
            options=disease_question_options,
        )
        disease_choice_response = disease_choice["message"]["content"].strip()

        disease_name = disease_choice_response.lower().replace(" ", "_")
    else:
        disease_choice = client.chat(
            model=config["PRIMARY_MODEL"],
            messages=[
                {
                    "role": "system",
                    "content": prompts["prompts"]["chat"]["system"],
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nIs the above block of text related to any of the following list of diseases? {collection_names_string}\nAnswer Yes or No.",
                },
                {
                    "role": "assistant",
                    "content": "No",
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nWhat is the disease that the above block of text is referring to? Answer only with the name of the disease in American English, do not use acronyms. If there is more than one disease, then respond with only the name of the main disease of the text.",
                },
                {"role": "assistant", "content": "The disease is:"},
            ],
            options=disease_question_options,
        )
        disease_choice_response = disease_choice["message"]["content"].strip()
        disease_name = disease_choice_response.lower().replace(" ", "_")

    focus_area_response = client.chat(
        model=config["PRIMARY_MODEL"],
        messages=[
            {
                "role": "system",
                "content": prompts["prompts"]["chat"]["system"],
            },
            {
                "role": "user",
                "content": f"{sample_text}\n\nIs the block of text focused on guidelines, diagnosis, treatment, epidemiology, pathophysiology, prognosis, clinical features, prevention, or miscellaneous? (answer only with one word)",
            },
        ],
        options=disease_question_options,
    )
    focus_area = (
        focus_area_response["message"]["content"]
        .strip()
        .lower()
        .replace(" ", "_")
    )

    # Document source selection (modified)
    existing_sources = list_sources_from_all_collections()
    existing_sources_string = ", ".join(existing_sources)

    document_source_question = client.chat(
        model=config["PRIMARY_MODEL"],
        messages=[
            {
                "role": "system",
                "content": prompts["prompts"]["chat"]["system"],
            },
            {
                "role": "user",
                "content": f"{sample_text}\n\nIs the source of this document one of the following? {existing_sources_string}\nAnswer Yes or No.",
            },
        ],
        options=disease_question_options,
    )
    source_answer = (
        document_source_question["message"]["content"].strip().lower()
    )

    if source_answer == "yes":
        document_source_choice = client.chat(
            model=config["PRIMARY_MODEL"],
            messages=[
                {
                    "role": "system",
                    "content": prompts["prompts"]["chat"]["system"],
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nWhich of the following sources is this document from? {existing_sources_string}\nRespond only with the source name as it appears in that list.",
                },
                {"role": "assistant", "content": "The source is:"},
            ],
            options=disease_question_options,
        )
        document_source = (
            document_source_choice["message"]["content"]
            .strip()
            .lower()
            .replace(" ", "_")
        )
    else:
        document_source_response = client.chat(
            model=config["PRIMARY_MODEL"],
            messages=[
                {
                    "role": "system",
                    "content": prompts["prompts"]["chat"]["system"],
                },
                {
                    "role": "user",
                    "content": f"{sample_text}\n\nWhat is the source of this document? Only give the name, no other commentary.",
                },
            ],
            options=disease_question_options,
        )
        document_source = (
            document_source_response["message"]["content"]
            .strip()
            .lower()
            .replace(" ", "_")
        )

    return disease_name, focus_area, document_source, filename


def generate_specialty_suggestions():
    """Generate RAG chat suggestions based on user's specialty from DB."""
    try:
        # Get user settings from DB
        user_settings = config_manager.get_user_settings()
        specialty = user_settings.get("specialty", "General Practice")

        # Get config and prompts
        config = config_manager.get_config()
        prompts = config_manager.get_prompts_and_options()

        # Initialize Ollama client
        client = ollamaClient(host=config["OLLAMA_BASE_URL"])

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

        response = client.chat(
            model=config["SECONDARY_MODEL"],
            messages=[
                {
                    "role": "system",
                    "content": "You are a medical education assistant. Keep all responses extremely concise.",
                },
                {"role": "user", "content": suggestion_prompt},
            ],
            format=ClinicalSuggestionList.model_json_schema(),
            options={
                **prompts["options"]["secondary"],
                "temperature": 0.7,
            },
        )

        suggestions = ClinicalSuggestionList.model_validate_json(
            response["message"]["content"]
        )

        return [s.question for s in suggestions.suggestions]

    except Exception as e:
        print(f"Error generating suggestions: {str(e)}")
        return [
            "How to diagnose lupus?",
            "Best treatment for pneumonia?",
            "When to start antibiotics?",
        ]
