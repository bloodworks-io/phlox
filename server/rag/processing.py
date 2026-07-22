import logging
import random

from server.database.config.manager import config_manager
from server.rag._specialty_suggestions import SUGGESTIONS

logger = logging.getLogger(__name__)

DEFAULT_SPECIALTY = "general practice"


def generate_specialty_suggestions():
    """Return 3 random clinical chat-starter questions for the user's specialty."""
    specialty = (
        config_manager.get_user_settings().get("specialty", DEFAULT_SPECIALTY) or DEFAULT_SPECIALTY
    )
    pool = SUGGESTIONS.get(specialty.strip().lower(), SUGGESTIONS[DEFAULT_SPECIALTY])
    return random.sample(pool, 3)
