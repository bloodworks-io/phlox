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
    stream_llm_response,
    tool_response_message,
)

logger = logging.getLogger(__name__)


def _sanitize_disease_name(disease_name: str) -> str:
    """Sanitize the disease name for use as a collection name."""
    return re.sub(r"[.\(\n/].*", "", disease_name.lower().replace(" ", "_")).rstrip("_").strip()


def _get_relevant_literature(chroma_manager, disease_name: str, question: str) -> str | list:
    """
    Retrieve relevant literature for a given disease and question.

    Args:
        chroma_manager: The ChromaManager instance.
        disease_name (str): The name of the disease.
        question (str): The question to search for in the literature.

    Returns:
        str | list: Relevant literature excerpts or a message if no literature is found.
    """
    logger.info(f"Searching literature for disease: '{disease_name}' with query: '{question}'")
    collection_names = chroma_manager.list_collections()
    sanitized_disease_name = _sanitize_disease_name(disease_name)

    logger.info(f"Sanitized disease name: '{sanitized_disease_name}'")
    logger.info(f"Available collections: {collection_names}")

    if sanitized_disease_name not in collection_names:
        logger.info(f"No collection found for disease: {sanitized_disease_name}")
        return "No relevant literature available"

    logger.info(f"Found matching collection for '{sanitized_disease_name}'")
    try:
        collection = chroma_manager.chroma_client.get_collection(
            name=sanitized_disease_name,
            embedding_function=chroma_manager.embedding_model,
        )

        logger.info(f"Querying collection with question: '{question}'")
        context = collection.query(
            query_texts=[question],
            n_results=5,
            include=["documents", "metadatas", "distances"],
        )

        logger.info(f"Query completed, received {len(context['documents'][0])} results")
        logger.info(f"Result distances: {context['distances'][0]}")
    except Exception as e:
        logger.error(f"Error querying collection: {e}")
        return "No relevant literature available"

    output_strings = []
    distance_threshold = 0.4
    logger.info(f"Filtering results with distance threshold: {distance_threshold}")

    for i, doc_list in enumerate(context["documents"]):
        for j, doc in enumerate(doc_list):
            distance = context["distances"][i][j]
            logger.info(f"Document {j + 1}: distance={distance}")
            if distance < distance_threshold:
                source = context["metadatas"][i][j]["source"]
                formatted_source = source.replace("_", " ").title()
                cleaned_doc = doc.strip().replace("\n", " ")
                logger.info(
                    f"Adding document from source: {formatted_source} (distance: {distance})"
                )
                output_strings.append(
                    f'According to {formatted_source}:\n\n"...{cleaned_doc}..."\n'
                )
            else:
                logger.info(f"Skipping document with distance {distance} (above threshold)")

    if not output_strings:
        logger.info("No relevant literature matching query found.")
        return "No relevant literature matching your query was found"

    logger.info(f"Retrieved {len(output_strings)} relevant literature excerpts.")
    return output_strings


async def execute(
    tool_call: dict[str, Any],
    llm_client,
    config: dict[str, Any],
    chroma_manager,
    message_list: list,
    context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """
    Execute the literature search tool.

    Args:
        tool_call: The tool call to execute.
        llm_client: The LLM client instance.
        config: The configuration dictionary.
        chroma_manager: The ChromaManager instance.
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
        chroma_manager=chroma_manager,
        disease_name=disease_name,
        question=question,
    )

    # Track citations and content for the function response
    citations: list[str] = []
    result_content: str = ""

    if function_response_list == "No relevant literature available":
        logger.info("No relevant literature found in database.")
        result_content = "No relevant literature available in the database. Answer the user's question but inform them that you were unable to find any relevant information."
        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )
    else:
        logger.info(f"Retrieved relevant literature for disease: {disease_name}")
        if isinstance(function_response_list, list):
            # Build citations from excerpts
            for excerpt in function_response_list:
                # Extract source from the excerpt format "According to {source}:\n\n..."
                match = re.search(r"According to ([^:]+):", excerpt)
                if match:
                    source = match.group(1)
                    citations.append(f"Clinical Guidelines ({source})")

            function_response_string = "\n".join(function_response_list)
        else:
            function_response_string = str(function_response_list)

        result_content = f"The below text excerpts are taken from relevant sections of the guidelines; these may help you answer the user's question. The user has not sent you these documents, they have come from your own database.\n\n{function_response_string}"

        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", "") if tool_call else "",
                content=result_content,
            )
        )

    if llm_client is not None:
        yield status_message("Generating response with retrieved information...")
        async for chunk in stream_llm_response(
            llm_client=llm_client,
            model=config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
        ):
            yield chunk

    yield end_message(function_response={"content": result_content, "citations": citations})
