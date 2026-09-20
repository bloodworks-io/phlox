"""Central thinking/reasoning control for OpenAI-compatible backends.

Maps the internal ``options["thinking"]`` intent ("on" | "off") to the request
parameters each backend dialect understands.
"""

import re
from urllib.parse import urlparse

from server.database.config.manager import config_manager
from server.utils.llama_models import PRECONFIGURED_MODELS, llama_model_manager

THINKING_ON = "on"
THINKING_OFF = "off"

# Hosts that reject unknown request arguments outright (OpenAI dialect).
STRICT_HOSTS = ("api.openai.com", "openrouter.ai")
STRICT_HOST_SUFFIXES = (".openai.azure.com",)

# Aggregators route to varying downstream providers per request, so learned
# param support is unstable there — never persist capability rows for them.
NON_PERSISTING_HOSTS = ("openrouter.ai",)

CHAT_TEMPLATE_KWARGS = "chat_template_kwargs"
REASONING_EFFORT = "reasoning_effort"

_THINKING_PARAMS = (CHAT_TEMPLATE_KWARGS, REASONING_EFFORT)

# Bundled local models below this size skip thinking in chat: the reasoning
# output is mostly noise and inflates time-to-first-token.
CHAT_THINKING_MIN_PARAMS_B = 7.0

_SIZE_TOKEN_RE = re.compile(r"(\d+(?:\.\d+)?)\s*[bB](?![a-zA-Z0-9])")

_UNRECOGNIZED_RE = re.compile(
    r"unrecognized request argument(?: supplied)?:?\s*['\"]?([\w.]+)",
    re.IGNORECASE,
)


def _host(base_url: str) -> str:
    try:
        return (urlparse(str(base_url)).hostname or "").lower()
    except ValueError:
        return ""


def is_strict_host(base_url: str) -> bool:
    """True for endpoints that 400 on unrecognised request arguments."""
    host = _host(base_url)
    if not host:
        return False
    return host in STRICT_HOSTS or host.endswith(STRICT_HOST_SUFFIXES)


def capability_key(base_url: str, model: str) -> str:
    """Stable capability-store key for a thinking-learning endpoint/model."""
    base = (str(base_url) or "").strip().lower().rstrip("/")
    model_name = (str(model) or "").strip().lower()
    return f"thinking|{base}|{model_name}"


def _rejected_params(base_url: str, model: str) -> set[str]:
    try:
        blob = config_manager.get_capability(capability_key(base_url, model)) or {}
    except Exception:
        return set()
    rejected = blob.get("thinking", {}).get("rejected", [])
    return {name for name in rejected if name in _THINKING_PARAMS}


def build_thinking_params(intent: str | None, base_url: str, model: str) -> dict:
    """Return top-level request params implementing the thinking intent.

    Combines the static dialect rules (tier 1) with persisted rejection
    learnings (tier 2). Returns {} when no params should be sent.
    """
    if intent not in (THINKING_ON, THINKING_OFF):
        return {}

    rejected = _rejected_params(base_url, model)

    if intent == THINKING_ON:
        # Ollama auto-enables thinking for capable models when reasoning_effort
        # is absent and OpenAI-dialect reasoning models think by default, so
        # strict hosts need no param at all (and would 400 on template kwargs).
        candidates = (
            [] if is_strict_host(base_url) else [(CHAT_TEMPLATE_KWARGS, {"enable_thinking": True})]
        )
    elif is_strict_host(base_url):
        candidates = [(REASONING_EFFORT, "none")]
    else:
        candidates = [
            (CHAT_TEMPLATE_KWARGS, {"enable_thinking": False}),
            (REASONING_EFFORT, "none"),
        ]

    return {name: value for name, value in candidates if name not in rejected}


def rejected_param_from_error(exc: Exception) -> str | None:
    """Return which thinking param a 400 error names, if any."""
    message = str(getattr(exc, "message", None) or exc)
    match = _UNRECOGNIZED_RE.search(message)
    if match and match.group(1) in _THINKING_PARAMS:
        return match.group(1)
    lowered = message.lower()
    if any(hint in lowered for hint in ("unrecognized", "unknown", "not supported")):
        for name in _THINKING_PARAMS:
            if name in lowered:
                return name
    return None


def note_rejected_param(base_url: str, model: str, param: str) -> bool:
    """Persist a learned param rejection; False when persistence is skipped."""
    if _host(base_url) in NON_PERSISTING_HOSTS:
        return False
    try:
        key = capability_key(base_url, model)
        blob = config_manager.get_capability(key) or {}
        rejected = list(blob.get("thinking", {}).get("rejected", []))
        if param not in rejected:
            rejected.append(param)
        blob.setdefault("thinking", {})["rejected"] = rejected
        config_manager.set_capability(key, blob)
    except Exception:
        return False
    return True


def chat_thinking_enabled() -> bool:
    """Whether chat requests should request thinking for the active model.

    Remote providers: always True (each dialect enables or safely ignores it).
    Local (bundled llama-server): only when the selected model is large enough
    for reasoning to be worth the latency (>= CHAT_THINKING_MIN_PARAMS_B).
    """
    try:
        config = config_manager.get_config()
    except Exception:
        return False
    if (config.get("LLM_PROVIDER") or "openai").lower() != "local":
        return True

    model_id = llama_model_manager.get_selected_model_id() or ""
    info = PRECONFIGURED_MODELS.get(model_id)
    if info and info.get("parameters_billions"):
        return info["parameters_billions"] >= CHAT_THINKING_MIN_PARAMS_B

    # Fallback for non-preconfigured selections: parse a size token (e.g. 9b)
    # from the model id / configured model name. Unparseable -> stay off.
    candidate = f"{model_id} {config.get('PRIMARY_MODEL') or ''}"
    match = _SIZE_TOKEN_RE.search(candidate)
    return bool(match and float(match.group(1)) >= CHAT_THINKING_MIN_PARAMS_B)
