"""
Wikipedia search tool implementation.

This tool searches Wikipedia for general information including medical topics.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import httpx

from server.utils.chat.streaming.response import (
    end_message,
    status_message,
    stream_llm_response,
    tool_response_message,
)
from server.utils.chat.tools.sanitization import sanitize_query_for_external_search

logger = logging.getLogger(__name__)

WIKIPEDIA_API_BASE = "https://en.wikipedia.org/w/api.php"
WEB_SEARCH_TOOL_NAME = "web_search"


async def search_wikipedia(query: str, max_results: int = 3) -> list[dict]:
    """Search Wikipedia for articles matching the query.

    Args:
        query: The search query
        max_results: Maximum number of results to return

    Returns:
        List of article dictionaries with title, extract, url
    """
    query = sanitize_query_for_external_search(query)

    # Wikipedia API requires a User-Agent header
    headers = {
        "User-Agent": "PhloxMedicalBot/1.0 (https://github.com/phlox-medical; bot@phlox.example)"
    }

    async with httpx.AsyncClient() as client:
        # Step 1: Search for article titles
        search_response = await client.get(
            WIKIPEDIA_API_BASE,
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": min(max_results, 10),
                "format": "json",
            },
            headers=headers,
        )
        search_data = search_response.json()
        search_results = search_data.get("query", {}).get("search", [])

        if not search_results:
            return []

        # Step 2: Get extracts (summaries) for each article
        titles = [result["title"] for result in search_results[:max_results]]
        extracts_response = await client.get(
            WIKIPEDIA_API_BASE,
            params={
                "action": "query",
                "prop": "extracts",
                "exintro": True,
                "explaintext": True,
                "exsentences": 5,  # Get first 5 sentences
                "titles": "|".join(titles),
                "format": "json",
            },
            headers=headers,
        )
        extracts_data = extracts_response.json()
        pages = extracts_data.get("query", {}).get("pages", {})

        articles = []
        for result in search_results[:max_results]:
            page_id = str(result["pageid"])
            page_data = pages.get(page_id, {})
            articles.append(
                {
                    "title": result["title"],
                    "extract": page_data.get("extract", ""),
                    "url": f"https://en.wikipedia.org/wiki?curid={page_id}",
                }
            )

        return articles


async def execute(
    tool_call: dict[str, Any],
    llm_client,
    config: dict[str, Any],
    message_list: list,
    context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute the Wikipedia search tool.

    Args:
        tool_call: The tool call to execute
        llm_client: The LLM client instance
        config: The configuration dictionary
        message_list: The current message list
        context_question_options: The context question options

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    logger.info("Executing web_search (Wikipedia) tool...")
    yield status_message("Searching Wikipedia...")

    function_arguments = {}
    if "arguments" in tool_call["function"]:
        try:
            if isinstance(tool_call["function"]["arguments"], str):
                function_arguments = json.loads(tool_call["function"]["arguments"])
            else:
                function_arguments = tool_call["function"]["arguments"]
        except json.JSONDecodeError:
            logger.error("Failed to parse function arguments JSON")

    query = function_arguments.get("query", "")
    max_results = function_arguments.get("max_results", 3)

    # Sanitize query to remove potential PHI
    query = sanitize_query_for_external_search(query)

    citations: list[str] = []
    result_content: str = ""

    if not query:
        logger.info("No query provided for web search")
        result_content = "No query provided. Please specify a search query."
        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )
    else:
        try:
            logger.info(f"Searching Wikipedia for: '{query}'")
            articles = await search_wikipedia(query, max_results)

            if not articles:
                result_content = f"No Wikipedia articles found for query: '{query}'"
                logger.info("No Wikipedia articles found")
            else:
                formatted = []
                for i, article in enumerate(articles):
                    logger.info(f"Article {i+1} extract length: {len(article['extract'])} chars")
                    parts = [
                        f"Title: {article['title']}",
                    ]
                    if article.get("extract"):
                        parts.append(f"Summary: {article['extract']}")
                    parts.append(f"URL: {article['url']}")
                    formatted.append("\n".join(parts))

                    # Build citation string
                    citation = f"Wikipedia: {article['title']}. {article['url']}"
                    citations.append(citation)

                result_content = "Found the following relevant articles:\n\n" + "\n\n---\n\n".join(formatted)
                logger.info(f"Retrieved {len(articles)} Wikipedia articles")

            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )
        except Exception as e:
            logger.error(f"Wikipedia search error: {e}")
            result_content = f"Error searching Wikipedia: {str(e)}"
            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )

    if llm_client is not None:
        yield status_message("Generating response with search results...")
        async for chunk in stream_llm_response(
            llm_client=llm_client,
            model=config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
        ):
            yield chunk

    yield end_message(function_response={"content": result_content, "citations": citations})
