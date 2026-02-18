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
            datetime.strptime(encounter_date, "%Y-%m-%d")
            if encounter_date
            else datetime.today()
        )
    except ValueError:
        raise ValueError("Invalid date format. Use 'YYYY-MM-DD'.")

    age = encounter_date_obj.year - birth_date.year
    if (encounter_date_obj.month, encounter_date_obj.day) < (
        birth_date.month,
        birth_date.day,
    ):
        age -= 1

    return age

def clean_think_tags(message_list):
    """
    Remove <think> tags and their contents from conversation history messages.

    Args:
        message_list (list): List of message dictionaries

    Returns:
        list: Cleaned message list with <think> tags removed
    """

    # Handle simple strings
    if isinstance(message_list, str):
        return re.sub(r"<think>.*?</think>", "", message_list, flags=re.DOTALL)

    cleaned_messages = []

    for message in message_list:
        if "content" in message and isinstance(message["content"], str):
            # Remove <think>...</think> patterns from content
            cleaned_content = re.sub(
                r"<think>.*?</think>", "", message["content"], flags=re.DOTALL
            )
            # Create a new message with cleaned content
            cleaned_message = message.copy()
            cleaned_message["content"] = cleaned_content.strip()
            cleaned_messages.append(cleaned_message)
        else:
            # If no content or not a string, keep the message as is
            cleaned_messages.append(message)

    return cleaned_messages
