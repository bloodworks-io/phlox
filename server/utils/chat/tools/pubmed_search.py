"""
PubMed search tool implementation.

This tool searches PubMed for medical literature and research articles.
"""

import json
import logging
import xml.etree.ElementTree as ET
from collections.abc import AsyncGenerator
from typing import Any

import httpx

from server.utils.chat.streaming.response import (
    end_message,
    status_message,
    stream_llm_response,
    tool_response_message,
)
from server.utils.chat.tools.sanitization import (
    sanitize_pubmed_query,
    sanitize_query_for_external_search,
)

logger = logging.getLogger(__name__)

PUBMED_API_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
PUBMED_TOOL_NAME = "pubmed_search"


def parse_pubmed_article(article_elem: ET.Element, pmid: str) -> dict:
    """Parse a PubMed article XML element into a dictionary.

    Args:
        article_elem: The XML element for a single article
        pmid: The PubMed ID

    Returns:
        Dictionary with article data including abstract if available
    """
    article_data = {"pmid": pmid, "title": "", "authors": [], "journal": "", "pubdate": "", "abstract": "", "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"}

    # Get title
    title_elem = article_elem.find(".//ArticleTitle")
    if title_elem is not None and title_elem.text:
        article_data["title"] = title_elem.text

    # Get journal info
    journal_elem = article_elem.find(".//Journal/Title")
    if journal_elem is not None and journal_elem.text:
        article_data["journal"] = journal_elem.text

    # Get publication date
    pub_date_elem = article_elem.find(".//Journal/JournalIssue/PubDate")
    if pub_date_elem is not None:
        year = pub_date_elem.find("Year")
        month = pub_date_elem.find("Month")
        year_text = year.text if year is not None else ""
        month_text = month.text if month is not None else ""
        article_data["pubdate"] = f"{year_text} {month_text}".strip()

    # Get authors
    authors_list = article_elem.find(".//AuthorList")
    if authors_list is not None:
        for author in authors_list.findall("Author"):
            last_name = author.find("LastName")
            fore_name = author.find("ForeName")
            if last_name is not None:
                name = last_name.text
                if fore_name is not None:
                    name += f" {fore_name.text[0] if fore_name.text else ''}"
                article_data["authors"].append(name)

    # Get abstract
    abstract_elem = article_elem.find(".//Abstract/AbstractText")
    if abstract_elem is not None:
        # Abstract text can be in nested elements or direct text
        abstract_parts = []
        if abstract_elem.text:
            abstract_parts.append(abstract_elem.text)
        for child in abstract_elem:
            if child.text:
                label = child.get("Label", "")
                if label:
                    abstract_parts.append(f"{label}: {child.text}")
                else:
                    abstract_parts.append(child.text)
            if child.tail:
                abstract_parts.append(child.tail)
        article_data["abstract"] = " ".join(abstract_parts).strip()

    return article_data


async def search_pubmed(query: str, max_results: int = 5) -> list[dict]:
    """Search PubMed for articles matching the query.

    Args:
        query: The search query
        max_results: Maximum number of results to return

    Returns:
        List of article dictionaries
    """
    # Sanitize query to remove standalone years that PubMed interprets as keywords
    query = sanitize_pubmed_query(query)

    async with httpx.AsyncClient() as client:
        # Step 1: Search for IDs
        search_response = await client.get(
            f"{PUBMED_API_BASE}/esearch.fcgi",
            params={
                "db": "pubmed",
                "term": query,
                "retmax": min(max_results, 20),  # Cap at 20 for rate limiting
                "retmode": "json",
            },
        )
        search_data = search_response.json()
        id_list = search_data.get("esearchresult", {}).get("idlist", [])

        if not id_list:
            return []

        # Step 2: Fetch full article details including abstracts using efetch
        fetch_response = await client.get(
            f"{PUBMED_API_BASE}/efetch.fcgi",
            params={
                "db": "pubmed",
                "id": ",".join(id_list),
                "rettype": "abstract",
                "retmode": "xml",
            },
        )

        articles = []
        root = ET.fromstring(fetch_response.text)

        # PubMed returns articles in PubmedArticle elements
        for article_elem in root.findall(".//PubmedArticle"):
            pmid_elem = article_elem.find(".//PMID")
            if pmid_elem is not None and pmid_elem.text:
                pmid = pmid_elem.text
                article_data = parse_pubmed_article(article_elem, pmid)
                articles.append(article_data)

        return articles


async def execute(
    tool_call: dict[str, Any],
    llm_client,
    config: dict[str, Any],
    message_list: list,
    context_question_options: dict[str, Any],
) -> AsyncGenerator[dict[str, Any], None]:
    """Execute the PubMed search tool.

    Args:
        tool_call: The tool call to execute
        llm_client: The LLM client instance
        config: The configuration dictionary
        message_list: The current message list
        context_question_options: The context question options

    Yields:
        Dict[str, Any]: Streaming response chunks
    """
    logger.info("Executing pubmed_search tool...")
    yield status_message("Searching PubMed...")

    # Parse function arguments
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
    max_results = function_arguments.get("max_results", 5)

    # Sanitize query to remove standalone years
    query = sanitize_pubmed_query(query)

    # Track citations for the function response
    citations: list[str] = []
    result_content: str = ""

    if not query:
        logger.info("No query provided for PubMed search")
        result_content = "No query provided. Please specify a search query."
        message_list.append(
            tool_response_message(
                tool_call_id=tool_call.get("id", ""),
                content=result_content,
            )
        )
    else:
        try:
            logger.info(f"Searching PubMed for: '{query}'")
            articles = await search_pubmed(query, max_results)

            if not articles:
                result_content = f"No PubMed articles found for query: '{query}'"
                logger.info("No PubMed articles found")
            else:
                formatted = []
                for i, article in enumerate(articles):
                    authors_str = ", ".join(article["authors"])
                    parts = [
                        f"Title: {article['title']}",
                        f"Authors: {authors_str}",
                        f"Journal: {article['journal']} ({article['pubdate']})",
                    ]
                    if article.get("abstract"):
                        # Log abstract length for verification
                        logger.info(f"Article {i+1} abstract length: {len(article['abstract'])} chars")
                        logger.debug(f"Article {i+1} abstract preview: {article['abstract'][:200]}...")
                        parts.append(f"Abstract: {article['abstract']}")
                    else:
                        logger.info(f"Article {i+1} has no abstract available")
                    parts.append(f"URL: {article['url']}")
                    formatted.append("\n".join(parts))

                    # Build citation string
                    citation = f"PubMed: {article['title']}. {article['journal']} ({article['pubdate']}). {article['url']}"
                    citations.append(citation)

                result_content = (
                    "Found the following relevant articles on PubMed:\n\n"
                    + "\n\n---\n\n".join(formatted)
                )
                logger.info(f"Retrieved {len(articles)} PubMed articles, total content length: {len(result_content)} chars")
                logger.debug(f"Content preview: {result_content[:500]}...")

            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )
        except Exception as e:
            logger.error(f"PubMed search error: {e}")
            result_content = f"Error searching PubMed: {str(e)}"
            message_list.append(
                tool_response_message(
                    tool_call_id=tool_call.get("id", ""),
                    content=result_content,
                )
            )

    if llm_client is not None:
        yield status_message("Generating response with PubMed results...")
        async for chunk in stream_llm_response(
            llm_client=llm_client,
            model=config["PRIMARY_MODEL"],
            messages=message_list,
            options=context_question_options,
        ):
            yield chunk

    yield end_message(function_response={"content": result_content, "citations": citations})
