"""
Tool registry for managing tool definitions.

This module provides the tool definitions used by the ChatEngine
to determine which actions to take based on user input.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _get_built_in_tools(collection_names: list[str]) -> list[dict[str, Any]]:
    """Get built-in tool definitions.

    Args:
        collection_names: List of available collection names

    Returns:
        List of built-in tool definitions
    """
    collection_names_string = ", ".join(collection_names)
    return [
        {
            "type": "function",
            "function": {
                "name": "transcript_search",
                "description": "Use this tool if the user asks about something from the transcript, interview, or conversation with the patient. This will search the transcript for relevant information.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_relevant_literature",
                "description": f"Only use this tool if answering the most recent message from the user would benefit from a literature search. Available disease areas: {collection_names_string}, other",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "disease_name": {
                            "type": "string",
                            "description": f"The disease that this question is referring to (must be one of: {collection_names_string}, other)",
                        },
                        "question": {
                            "type": "string",
                            "description": "The question to be answered. Try and be specific and succinct.",
                        },
                    },
                    "required": ["disease_name", "question"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "pubmed_search",
                "description": "Search PubMed for medical literature and research articles. Use this when the user asks about recent research, clinical studies, or medical publications.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query for PubMed (e.g., 'diabetes treatment guidelines')",
                        },
                        "max_results": {
                            "type": "integer",
                            "description": "Maximum number of results to return (default: 5, max: 20)",
                        },
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "wiki_search",
                "description": "Search Wikipedia for general medical information, drug information, disease overviews, and clinical guidelines. Use this for background information, drug details, or when PubMed is too specific. IMPORTANT: Use only 1-2 word queries (e.g., 'hydroxyurea', 'thrombocythemia', 'aspirin') not full sentences.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query - use only 1-2 words maximum (e.g., 'hydroxyurea', 'warfarin')",
                        },
                        "max_results": {
                            "type": "integer",
                            "description": "Maximum number of results to return (default: 3, max: 10)",
                        },
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_previous_encounter",
                "description": "Retrieve previous encounters for a patient. You can search by UR number OR patient name. Use UR number if known; otherwise use patient name to search for matching patients.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "ur_number": {
                            "type": "string",
                            "description": "Patient's UR number (preferred if known)",
                        },
                        "patient_name": {
                            "type": "string",
                            "description": "Patient's name to search (use if UR number is unknown)",
                        },
                        "current_encounter_date": {
                            "type": "string",
                            "description": "Current encounter date in YYYY-MM-DD format to exclude from results",
                        },
                    },
                    "required": [],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "direct_response",
                "description": "Use this tool if the most recent question from the user is a non-medical query (greetings, chat, clarifications).",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_note",
                "description": "Create a new patient encounter note for a specific date. Use this when scheduling patients, creating notes from a clinic list, or setting up encounters for upcoming appointments. IMPORTANT: Always include the ur_number when creating notes for existing patients to ensure their history is carried forward.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_name": {
                            "type": "string",
                            "description": "Full name of the patient",
                        },
                        "encounter_date": {
                            "type": "string",
                            "description": "Date of the encounter in YYYY-MM-DD format",
                        },
                        "ur_number": {
                            "type": "string",
                            "description": "Patient's UR number (medical record number). IMPORTANT: Always provide this for existing patients to fetch their history and pre-fill persistent fields.",
                        },
                        "dob": {
                            "type": "string",
                            "description": "Patient's date of birth in YYYY-MM-DD format, if known",
                        },
                        "initial_notes": {
                            "type": "string",
                            "description": "Any initial notes or context for the encounter",
                        },
                    },
                    "required": ["patient_name", "encounter_date"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_patient_jobs",
                "description": "Get outstanding jobs/tasks for a specific patient. Use this when the user asks about pending tasks, follow-ups, or outstanding items for a patient.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "ur_number": {
                            "type": "string",
                            "description": "Patient's UR number (medical record number)",
                        },
                        "patient_name": {
                            "type": "string",
                            "description": "Patient's name (use if UR number is not known)",
                        },
                    },
                    "required": [],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "todo_list",
                "description": "Access the user's global todo list. Use this to list todos, add new tasks, mark tasks as complete, or delete tasks.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "enum": ["list", "add", "complete", "delete"],
                            "description": "Action to perform: 'list' all todos, 'add' a new task, 'complete' a task, or 'delete' a task",
                        },
                        "task": {
                            "type": "string",
                            "description": "Task description (required for 'add' action)",
                        },
                        "todo_id": {
                            "type": "integer",
                            "description": "Todo item ID (required for 'complete' and 'delete' actions)",
                        },
                    },
                    "required": ["action"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_patient_notes",
                "description": "Search through a patient's historical notes and encounters for specific terms or conditions. Use this when the user asks about a patient's history with a particular condition, specialist, medication, or event. Uses fuzzy matching to find relevant mentions.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "ur_number": {
                            "type": "string",
                            "description": "Patient's UR number (preferred)",
                        },
                        "patient_name": {
                            "type": "string",
                            "description": "Patient's name (if UR number unknown)",
                        },
                        "search_term": {
                            "type": "string",
                            "description": "The word or phrase to search for (e.g., 'nephrologist', 'diabetes', 'MRI')",
                        },
                    },
                    "required": ["search_term"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_outstanding_jobs",
                "description": "Get a list of all patients with outstanding (incomplete) jobs or follow-up tasks. Use this when the user asks about pending work, follow-ups needed, or what tasks are outstanding across patients.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
        {
            "type": "function",
            "function": {
                "name": "complete_job",
                "description": "Mark a specific job or task as completed for a patient encounter. Use this when the user confirms a task has been done or wants to tick off a job. IMPORTANT: You need the patient_id (record ID) from list_outstanding_jobs or get_patient_jobs, not just the patient name.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "patient_id": {
                            "type": "integer",
                            "description": "The database record ID of the patient encounter (obtained from list_outstanding_jobs or get_patient_jobs)",
                        },
                        "job_id": {
                            "type": "integer",
                            "description": "The ID of the job within that record's jobs_list to mark as completed",
                        },
                    },
                    "required": ["patient_id", "job_id"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
    ]


def get_tools_definition(collection_names: list[str], *, exclude_chat_only: bool = False) -> list[dict[str, Any]]:
    """
    Get the tools definition based on available collections and MCP servers.

    Args:
        collection_names: List of available collection names
        exclude_chat_only: If True, exclude tools that only work in chat context

    Returns:
        List of tool definitions including built-in and MCP tools
    """
    CHAT_ONLY_TOOLS = {"transcript_search", "direct_response"}
    from server.database.config.manager import config_manager

    built_in_tools = _get_built_in_tools(collection_names)

    # Filter out disabled tools based on user settings
    user_settings = config_manager.get_user_settings()
    disabled_tools = set(user_settings.get("disabled_tools", ["pubmed_search", "wiki_search"]))

    enabled_tools = [
        tool for tool in built_in_tools
        if tool["function"]["name"] not in disabled_tools
    ]

    if disabled_tools:
        logger.info(f"Filtered out disabled tools: {disabled_tools}")

    # Filter out chat-only tools if requested
    if exclude_chat_only:
        enabled_tools = [
            tool for tool in enabled_tools
            if tool["function"]["name"] not in CHAT_ONLY_TOOLS
        ]
        logger.info(f"Filtered out chat-only tools: {CHAT_ONLY_TOOLS}")

    # Add MCP tools if available
    try:
        from server.utils.mcp.client import get_mcp_tools_sync

        mcp_tools = get_mcp_tools_sync()
        if mcp_tools:
            # Return the tool definitions (without internal metadata)
            for tool in mcp_tools:
                enabled_tools.append(
                    {
                        "type": tool["type"],
                        "function": tool["function"],
                    }
                )
            logger.info(f"Loaded {len(mcp_tools)} tools from MCP servers")
    except ImportError:
        # MCP not installed, skip
        pass
    except Exception as e:
        logger.error(f"Failed to load MCP tools: {e}")

    return enabled_tools
