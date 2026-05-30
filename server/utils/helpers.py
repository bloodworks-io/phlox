import logging
import re
from datetime import datetime

# Set up module-level logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def calculate_age(dob: str, encounter_date: str = None) -> int:
    """
    Calculate the age of a patient at the time of encounter or current date.

    Args:
        dob (str): Date of birth in 'YYYY-MM-DD' format.
        encounter_date (str, optional): Date of encounter in 'YYYY-MM-DD' format.
            If not provided, current date is used.

    Returns:
        int: The calculated age in years.

    Raises:
        ValueError: If DOB is missing or in an invalid format.
    """
    if not dob:
        raise ValueError("DOB is missing")

    try:
        birth_date = datetime.strptime(dob, "%Y-%m-%d")
        encounter_date_obj = (
            datetime.strptime(encounter_date, "%Y-%m-%d") if encounter_date else datetime.today()
        )
    except ValueError:
        raise ValueError("Invalid date format. Use 'YYYY-MM-DD'.") from None

    age = encounter_date_obj.year - birth_date.year
    if (encounter_date_obj.month, encounter_date_obj.day) < (
        birth_date.month,
        birth_date.day,
    ):
        age -= 1

    return age


def _remove_think_blocks(text: str) -> str:
    """Remove reasoning-tag blocks from *text* in linear time.

    Uses a two-pass approach: first match an opening tag with a simple
    (non-backtracking) regex, then locate the corresponding closing tag via
    ``str.find``.  This avoids the quadratic worst-case of a single large
    alternation with ``.*?`` that CodeQL flags as a polynomial regex.
    """
    # Opening tags we recognise — simple alternation, no .* quantifier.
    _OPEN_RE = re.compile(
        r"<(?:think|thinking|reason|reasoning|thought|Thought)>"
        r"|<\|begin_of_thought\|>"
        r"|◁think▷"
    )

    # Canonical close tag for every open tag prefix we match.
    _CLOSE = {
        "<think": "</think",
        "<thinking": "</thinking",
        "<reason": "</reason",
        "<reasoning": "</reasoning",
        "<thought": "</thought",
        "<Thought": "</Thought>",
        "<|begin_of_thought|>": "<|end_of_thought|>",
        "◁think▷": "◁/think▷",
    }

    result: list[str] = []
    pos = 0
    for m in _OPEN_RE.finditer(text):
        # Append everything before this opening tag.
        result.append(text[pos : m.start()])

        # Determine which opening tag matched so we pick the right close tag.
        close_tag = None
        for prefix, ctag in _CLOSE.items():
            if m.group().startswith(prefix):
                close_tag = ctag
                break

        if close_tag:
            end = text.find(close_tag, m.end())
            pos = text.find(">", end) + 1 if end != -1 else len(text)
        else:
            # No known close tag — skip just the open tag.
            pos = m.end()

    result.append(text[pos:])
    return "".join(result)


def clean_think_tags(message_list):
    """
    Remove reasoning tags and their contents from conversation history messages.

    Args:
        message_list (list): List of message dictionaries

    Returns:
        list: Cleaned message list with reasoning tags removed
    """

    # Handle simple strings
    if isinstance(message_list, str):
        return _remove_think_blocks(message_list)

    cleaned_messages = []

    for message in message_list:
        if "content" in message and isinstance(message["content"], str):
            # Remove reasoning tag patterns from content
            cleaned_content = _remove_think_blocks(message["content"])
            # Create a new message with cleaned content
            cleaned_message = message.copy()
            cleaned_message["content"] = cleaned_content.strip()
            cleaned_messages.append(cleaned_message)
        else:
            # If no content or not a string, keep the message as is
            cleaned_messages.append(message)

    return cleaned_messages
