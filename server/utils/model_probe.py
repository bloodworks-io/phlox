import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


async def probe_and_store_model_behavior(
    provider: str,
    base_url: Optional[str],
    api_key: Optional[str],
    model: str,
) -> Dict[str, Any]:
    """
    Dummy function for probing model behavior.
    Does nothing and returns a default response to prevent breaking changes.
    """
    logger.info(
        f"Skipping probe for model behavior (dummy function): "
        f"provider='{provider}', model='{model}'"
    )

    # Return a default response indicating no probing occurred
    return {
        "probed": False,
        "provider": provider,
        "model": model,
        "capability_type": "none",
        "reasoning_field_name": None,
        "tag_names": [],
    }
