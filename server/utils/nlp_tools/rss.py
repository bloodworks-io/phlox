import ipaddress
import json
import logging
import socket
from datetime import datetime
from typing import Any, Dict, List, Union
from urllib.parse import urlparse

import feedparser
import httpx
from fastapi import HTTPException
from server.database.config.manager import config_manager
from server.schemas.dashboard import RssItem
from server.schemas.grammars import ItemDigest, NewsDigest
from server.utils.llm_client import repair_json
from server.utils.llm_client.client import get_llm_client

logger = logging.getLogger(__name__)


def validate_public_http_url(url: str) -> str:
    """
    Validates that a URL is a public HTTP/HTTPS URL and does not resolve to
    private/internal IP addresses to prevent SSRF attacks.

    Args:
        url: The URL to validate.

    Returns:
        The normalized URL string if validation passes.

    Raises:
        HTTPException: If the URL is invalid or resolves to a private IP.
    """
    parsed = urlparse(url)

    # Ensure scheme is http or https
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid URL scheme: {parsed.scheme}. Only http and https are allowed."
        )

    # Extract hostname
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(
            status_code=400,
            detail="Invalid URL: no hostname found."
        )

    try:
        # Resolve hostname to IP addresses
        addr_infos = socket.getaddrinfo(hostname, None)
        resolved_ips = {addr_info[4][0] for addr_info in addr_infos}
    except socket.gaierror as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to resolve hostname: {hostname}"
        ) from e

    # Check if any resolved IP is private, loopback, link-local, multicast, or reserved
    for ip_str in resolved_ips:
        try:
            ip = ipaddress.ip_address(ip_str)
            if (ip.is_private or ip.is_loopback or ip.is_link_local or
                ip.is_multicast or ip.is_reserved):
                raise HTTPException(
                    status_code=400,
                    detail=f"URL resolves to disallowed IP address: {ip_str}"
                )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid IP address resolved: {ip_str}"
            )

    # Return the normalized URL
    return parsed.geturl()


async def get_feed_title(feed_url: str) -> str:
    """Fetches the title of an RSS feed."""
    # Validate URL to prevent SSRF attacks
    validated_url = validate_public_http_url(feed_url)

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(validated_url)
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=400, detail=f"Error fetching RSS feed: {str(e)}"
            )

    feed = feedparser.parse(response.text)
    return feed.feed.get("title", "Unknown Feed")


async def generate_item_digest(item: RssItem) -> str:
    """
    Generates a digest for an RSS item using LLM.

    Args:
        item (RssItem): The RSS item to generate a digest for.

    Returns:
        str: The generated digest.
    """
    try:
        config = config_manager.get_config()
        client = get_llm_client()
        model = config["SECONDARY_MODEL"]
        options = config_manager.get_prompts_and_options()["options"][
            "secondary"
        ]

        json_schema_instruction = (
            "Output MUST be ONLY valid JSON with top-level key "
            '"digest" (string). Example: ' + json.dumps({"digest": "..."})
        )

        system_prompt = (
            """You are a medical news summarizer. Your task is to summarize medical news articles in a concise, informative way for healthcare professionals. Focus on clinical relevance, key findings, and implications for practice. Keep summaries objective and factual.

"""
            + json_schema_instruction
        )

        user_prompt = f"""Summarize this medical article in 1-2 concise sentences that highlight the key finding or clinical implication:

        Title: {item.title}
        Source: {item.feed_title}
        Content: {item.description}"""

        # Base schema for structured output (no thinking field)
        base_schema = ItemDigest.model_json_schema()

        request_body = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response_json = await client.chat_with_structured_output(
            model=model,
            messages=request_body,
            schema=base_schema,
            options=options,
        )

        if isinstance(response_json, str):
            response_json = repair_json(response_json)
        else:
            response_json = json.dumps(response_json)

        digest_data = ItemDigest.model_validate_json(response_json)
        return digest_data.digest

    except Exception as e:
        logger.error(f"Error generating item digest: {e}")
        return "Unable to generate digest."


async def generate_combined_digest(articles: List[Dict[str, str]]) -> str:
    """
    Generates a combined digest for multiple articles using LLM.

    Args:
        articles (List[Dict[str, str]]): List of articles to generate a digest for.

    Returns:
        str: The generated combined digest.
    """
    if not articles:
        return "No recent medical news available."

    try:
        config = config_manager.get_config()
        client = get_llm_client()
        model = config["PRIMARY_MODEL"]
        options = config_manager.get_prompts_and_options()["options"]["general"]

        json_schema_instruction = (
            "Output MUST be ONLY valid JSON with top-level key "
            '"digest" (string). Example: ' + json.dumps({"digest": "..."})
        )

        system_prompt = (
            """You are a medical news curator for busy healthcare professionals. Your task is to create a concise digest of recent medical news articles, highlighting their clinical significance. Focus on what's most relevant to medical practice.

"""
            + json_schema_instruction
        )

        # Format articles for the prompt
        article_text = ""
        for i, article in enumerate(articles, 1):
            article_text += f"Article {i}:\nTitle: {article['title']}\nSource: {article.get('feed_title', 'Unknown')}\nDescription: {article['description']}\n\n"

        user_prompt = f"""Create a concise digest of these recent medical news articles in 3-4 sentences total. Focus on clinical implications and highlight the most important findings across all articles:

        {article_text}"""

        # Base schema for structured output (no thinking field)
        base_schema = NewsDigest.model_json_schema()

        request_body = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response_json = await client.chat_with_structured_output(
            model=model,
            messages=request_body,
            schema=base_schema,
            options=options,
        )

        if isinstance(response_json, str):
            response_json = repair_json(response_json)
        else:
            response_json = json.dumps(response_json)

        digest_data = NewsDigest.model_validate_json(response_json)
        return digest_data.digest

    except Exception as e:
        logger.error(f"Error generating combined digest: {e}")
        return "Unable to generate digest of recent medical news."


async def fetch_rss_feed(feed_url: str) -> List[RssItem]:
    """Fetches and processes an RSS feed."""
    # Validate URL to prevent SSRF attacks
    validated_url = validate_public_http_url(feed_url)

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(validated_url)
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=400, detail=f"Error fetching RSS feed: {str(e)}"
            )

    feed = feedparser.parse(response.text)

    if not feed.entries:
        raise HTTPException(
            status_code=400, detail="No entries found in the RSS feed"
        )

    def get_entry_date(entry):
        # Try to get the published date, fall back to updated date, or use epoch if neither exists
        date = entry.get("published_parsed") or entry.get("updated_parsed")
        if date:
            return datetime(*date[:6])
        return datetime.fromtimestamp(0)

    # Sort entries by date, most recent first
    sorted_entries = sorted(feed.entries, key=get_entry_date, reverse=True)

    rss_items = []
    for entry in sorted_entries:
        published = entry.get("published") or entry.get("updated")
        rss_items.append(
            RssItem(
                title=entry.get("title", "No title"),
                link=entry.get("link", "#"),
                description=entry.get("description", "No description"),
                published=published,
            )
        )

    return rss_items
