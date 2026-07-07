"""
Literature search tool implementation.

This tool searches the medical literature database for relevant information.
"""

import json
import logging
import re
from collections.abc import AsyncGenerator
from typing import Any

from server.utils.chat.streaming.response import (
    end_message,
    status_message,
)

logger = logging.getLogger(__name__)


def _sanitize_disease_name(disease_name: str) -> str:
    """Sanitize the disease name for use as a collection name."""
    return re.sub(r"[.\(\n/].*", "", disease_name.lower().replace(" ", "_")).rstrip("_").strip()


def _get_relevant_literature(
    vector_store_manager, disease_name: str, question: str
) -> str | list[dict]:
    """
    Retrieve relevant literature for a given disease and question.

    Args:
        vector_store_manager: The VectorStoreManager instance.
        disease_name: The name of the disease.
        question: The question to search for in the literature.

    Returns:
        str | list[dict]: Sentinel string if no literature, else a list of
        ``{"source", "formatted_source", "snippet", "download_url?"}`` dicts.
        ``download_url`` is included only when the original PDF is stored.
    """
    logger.info(f"Searching literature for disease: '{disease_name}' with query: '{question}'")
    collection_names = vector_store_manager.list_collections()
    sanitized_disease_name = _sanitize_disease_name(disease_name)

    logger.info(f"Sanitized disease name: '{sanitized_disease_name}'")
    logger.info(f"Available collections: {collection_names}")


    collection_slugs = {_sanitize_disease_name(c) for c in collection_names}
    if sanitized_disease_name not in collection_slugs:
        logger.info(f"No collection found for disease: {sanitized_disease_name}")
        return "No relevant literature available"

    logger.info(f"Found matching collection for '{sanitized_disease_name}'")
    try:
        context = vector_store_manager.query_similar(
            collection_name=sanitized_disease_name,
            query_text=question,
            n_results=5,
        )

        logger.info(f"Query completed, received {len(context['documents'][0])} results")
        logger.info(f"Result distances: {context['distances'][0]}")
    except Exception as e:
        logger.error(f"Error querying collection: {e}")
        return "No relevant literature available"

    try:
        downloadable = {
            f["filename"]
            for f in vector_store_manager.get_files_for_collection_with_pdf_flag(
                sanitized_disease_name
            )
            if f.get("has_pdf")
        }
    except Exception as e:
        logger.warning(f"Could not fetch downloadable files list: {e}")
        downloadable = set()

    excerpts: list[dict] = []

    for i, doc_list in enumerate(context["documents"]):
        for j, doc in enumerate(doc_list):
            distance = context["distances"][i][j]
            meta = context["metadatas"][i][j]
            source = meta.get("source", "")
            filename = meta.get("filename", "")
            formatted_source = source
            cleaned_doc = doc.strip().replace("\n", " ")
            logger.info(f"Adding document from source: {formatted_source} (distance: {distance})")
            entry = {
                "source": source,
                "formatted_source": formatted_source,
                "snippet": cleaned_doc,
            }
            if filename and filename in downloadable:
                from urllib.parse import quote

                entry["download_url"] = (
                    f"/api/rag/download-pdf/{quote(sanitized_disease_name)}/{quote(filename)}"
                )
            excerpts.append(entry)

    if not excerpts:
        logger.info("No relevant literature matching query found.")
        return "No relevant literature matching your query was found"

    logger.info(f"Retrieved {len(excerpts)} relevant literature excerpts.")
    return excerpts


async def execute(
    tool_call: dict[str, Any],
    _llm_client,
    _config: dict[str, Any],
    vector_store_manager,
    _message_list: list,
    _context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """
    Execute the literature search tool.

    Args:
        tool_call: The tool call to execute.
        llm_client: The LLM client instance.
        config: The configuration dictionary.
        vector_store_manager: The VectorStoreManager instance.
        message_list: The current message list.
        context_question_options: The context question options.

    Yields:
        Dict[str, Any]: Streaming response chunks.
    """
    logger.info("Executing get_relevant_literature tool...")
    yield status_message("Searching medical literature...")

    # Parse function arguments
    function_arguments = None
    if "arguments" in tool_call["function"]:
        try:
            if isinstance(tool_call["function"]["arguments"], str):
                function_arguments = json.loads(tool_call["function"]["arguments"])
            else:
                function_arguments = tool_call["function"]["arguments"]
        except json.JSONDecodeError:
            logger.error("Failed to parse function arguments JSON")
            function_arguments = {}

    disease_name = function_arguments.get("disease_name", "") if function_arguments else ""
    question = function_arguments.get("question", "") if function_arguments else ""

    function_response_list = _get_relevant_literature(
        vector_store_manager=vector_store_manager,
        disease_name=disease_name,
        question=question,
    )

    # Track citations and content for the function response
    citations: list[dict] = []
    result_content: str = ""

    if function_response_list == "No relevant literature available":
        logger.info("No relevant literature found in database.")
        result_content = "No relevant literature available in the database. Answer the user's question but inform them that you were unable to find any relevant information."
    else:
        logger.info(f"Retrieved relevant literature for disease: {disease_name}")
        if isinstance(function_response_list, list):
            formatted = []
            for i, ex in enumerate(function_response_list):
                formatted_source = ex["formatted_source"]
                snippet = ex["snippet"]
                download_url = ex.get("download_url")
                suffix = " (original PDF available for download)" if download_url else ""
                formatted.append(
                    f'[{i + 1}] According to {formatted_source}:\n\n"...{snippet}..."{suffix}'
                )
                citation = {
                    "type": "literature",
                    "source": formatted_source,
                    "snippet": snippet,
                }
                if download_url:
                    citation["url"] = download_url
                    citation["title"] = formatted_source
                citations.append(citation)
            function_response_string = "\n\n".join(formatted)
        else:
            function_response_string = str(function_response_list)

        result_content = f"The below text excerpts are taken from relevant sections of the guidelines; these may help you answer the user's question. The user has not sent you these documents, they have come from your own database.\n\n{function_response_string}"

    yield end_message(function_response={"content": result_content, "citations": citations})
