"""
Chat tools definitions for the Phlox application.

This module contains the tool definitions used by the ChatEngine to determine
which actions to take based on user input.
"""

def get_tools_definition(collection_names):
    """
    Get the tools definition based on available collections.

    Args:
        collection_names (list): List of available collection names

    Returns:
        list: List of tool definitions
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
    ]
