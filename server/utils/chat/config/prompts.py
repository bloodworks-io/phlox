"""
System message and prompt configuration for the ChatEngine.

This module handles the construction of system messages and doctor context
for chat interactions.
"""

import logging

from server.database.config.manager import config_manager

logger = logging.getLogger(__name__)


def build_system_messages() -> list:
    """
    Build the system messages for chat interactions.

    Returns:
        list: A list of system message dictionaries containing the base
              system prompt and optional doctor context.
    """
    prompts = config_manager.get_prompts_and_options()

    # Get user settings for doctor's name and specialty
    user_settings = config_manager.get_user_settings()
    doctor_name = user_settings.get("name", "")
    specialty = user_settings.get("specialty", "")

    messages = [
        {
            "role": "system",
            "content": prompts["prompts"]["chat"]["system"],
        }
    ]

    # Add doctor context as additional system message if available
    if doctor_name or specialty:
        doctor_context = "You are assisting."
        if doctor_name and specialty:
            doctor_context += f" {doctor_name}, a {specialty} specialist."
        elif doctor_name:
            doctor_context += f" {doctor_name}."
        else:
            doctor_context += f" a {specialty} specialist."

        messages.append({"role": "system", "content": doctor_context})

    return messages
