import re
import json
import httpx
import logging
from typing import Dict, Any, Optional, Tuple
from server.database.config import config_manager
from server.database.connection import db

logger = logging.getLogger(__name__)

THINK_TAG_REGEX = re.compile(
    r"<\s*(think|thinking|reasoning)\s*>.*?</\s*\1\s*>",
    re.DOTALL | re.IGNORECASE,
)


def detect_behavior_from_raw_response(
    resp_json: Dict[str, Any],
) -> Tuple[str, Optional[str], Optional[list]]:
    """
    Returns (capability_type, reasoning_field_name, tag_names)
    capability_type in {'field', 'tags', 'none'}
    """
    try:
        choices = resp_json.get("choices") or []
        logger.info(f"Detecting behavior: choices_count={len(choices)}")
        if not choices:
            logger.info(
                "No choices found in response; defaulting to capability_type='none'"
            )
            return ("none", None, None)

        msg = choices[0].get("message") or {}
        # Separate reasoning field?
        for key in ["reasoning_content", "reasoning", "thoughts"]:
            if key in msg and isinstance(msg[key], str) and msg[key].strip():
                logger.info(f"Detected separate reasoning field: key='{key}'")
                return ("field", key, None)

        # Think tags in content?
        content = msg.get("content") or ""
        if isinstance(content, str) and THINK_TAG_REGEX.search(content):
            tags = set(
                m.group(1).lower() for m in THINK_TAG_REGEX.finditer(content)
            )
            logger.info(f"Detected think tags in content: tags={sorted(tags)}")
            return ("tags", None, sorted(tags))

        logger.info(
            "No reasoning field or think tags detected; capability_type='none'"
        )
        return ("none", None, None)
    except Exception as e:
        logger.warning(f"Failed to detect behavior from response: {e}")
        return ("none", None, None)


async def probe_and_store_model_behavior(
    provider: str,
    base_url: Optional[str],
    api_key: Optional[str],
    model: str,
) -> Dict[str, Any]:
    """
    Probes the configured provider/model to determine thinking behavior and stores it.
    Only supports OpenAI-compatible endpoints for probing; for Ollama we default to 'none' unless tags are observed.
    """
    provider = (provider or "").lower()
    logger.info(
        f"Starting probe for model behavior: provider='{provider}', model='{model}', base_url_present={'yes' if base_url else 'no'}"
    )

    # Default values for Ollama: we can optionally extend this to try tags via the Ollama API later
    if provider == "ollama":
        logger.info(
            "Provider is 'ollama'; skipping probe and defaulting capability_type='none'"
        )
        behavior = {
            "capability_type": "none",
            "reasoning_field_name": None,
            "tag_names": [],
        }
        db.upsert_model_capability(provider, model, **behavior)
        logger.info("Stored default capability for Ollama in database")
        return {
            "probed": False,
            "provider": provider,
            "model": model,
            **behavior,
        }

    if provider != "openai" or not base_url:
        logger.info(
            "Provider is not 'openai' or base_url missing; skipping probe and defaulting capability_type='none'"
        )
        behavior = {
            "capability_type": "none",
            "reasoning_field_name": None,
            "tag_names": [],
        }
        db.upsert_model_capability(provider, model, **behavior)
        logger.info("Stored default capability in database")
        return {
            "probed": False,
            "provider": provider,
            "model": model,
            **behavior,
        }

    url = base_url.rstrip("/") + "/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say hello in English."},
        ],
    }

    try:
        logger.info(f"Sending probe request to '{url}' for model='{model}'")
        async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
            r = await client.post(url, json=payload)
            logger.info(
                f"Probe response status={r.status_code} for model='{model}'"
            )
            # We accept 200, and also some providers may return 4xx if model is missing; we won't store in that case.
            if r.status_code != 200:
                logger.info(
                    f"Probe failed with status {r.status_code}: {r.text[:200]}"
                )
                behavior = {
                    "capability_type": "none",
                    "reasoning_field_name": None,
                    "tag_names": [],
                }
                db.upsert_model_capability(provider, model, **behavior)
                logger.info(
                    "Stored default capability in database after failed probe"
                )
                return {
                    "probed": False,
                    "provider": provider,
                    "model": model,
                    **behavior,
                }

            logger.info(
                "Probe succeeded; analyzing response for thinking behavior"
            )
            resp_json = r.json()
            cap_type, reason_field, tag_names = (
                detect_behavior_from_raw_response(resp_json)
            )
            logger.info(
                f"Detected behavior: capability_type='{cap_type}', reasoning_field='{reason_field}', tags={tag_names or []}"
            )

            behavior = {
                "capability_type": cap_type,
                "reasoning_field_name": reason_field,
                "tag_names": tag_names or [],
            }
            db.upsert_model_capability(
                provider,
                model,
                capability_type=behavior["capability_type"],
                tag_names=behavior["tag_names"],
                reasoning_field_name=behavior["reasoning_field_name"],
                sample_raw_response=json.dumps(resp_json),
                notes=None,
            )
            logger.info("Stored detected capability in database")
            return {
                "probed": True,
                "provider": provider,
                "model": model,
                **behavior,
            }
    except Exception as e:
        logger.error(f"Error probing model behavior: {e}")
        behavior = {
            "capability_type": "none",
            "reasoning_field_name": None,
            "tag_names": [],
        }
        db.upsert_model_capability(provider, model, **behavior)
        logger.info(
            "Stored default capability in database after exception during probe"
        )
        return {
            "probed": False,
            "provider": provider,
            "model": model,
            **behavior,
        }
