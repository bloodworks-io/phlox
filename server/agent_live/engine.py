"""Live scribe agent engine.

Owns the per-session hot loop:
  audio segment -> transcribe -> gate (SKIP/NOTE/ACT) -> agent tick
                                              ^ debounce backstop

The agent tick is a free-form tool-calling loop (NO JSON grammar) on
PRIMARY_MODEL with thinking off via the central default (see
llm_client.thinking). The conversation is
append-only so provider prompt caches stay valid across ticks.

While a tick is running the gate is bypassed: the next tick consumes all
un-sent transcript segments anyway, so a SKIP/NOTE/ACT verdict would be
moot — and the call would contend with the tick for the inference server.
The idle-state gate uses a single-token logprob readout (calibrated
P(SKIP/NOTE/ACT) in one decode step), falling back to one-word generation
when a provider does not return logprobs. The readout applies a skip-mass
rescue: a short NOTE-carrying utterance whose SKIP mass is high is
downgraded to SKIP (never ACT; the debounce backstop bounds misses).
"""

import asyncio
import json
import logging
import math
import time
from typing import Any

from server.agent_live.prompts import (
    GATE_SYSTEM_PROMPT,
    build_live_system_prompt,
    build_tidy_tick_message,
    build_tidy_transition_message,
)
from server.agent_live.session import LiveSession
from server.agent_live.tools import execute_live_tool, get_live_tools_definition
from server.database.config.manager import config_manager
from server.transcription.audio import transcribe_audio
from server.transcription.speakers import format_segment, split_speaker_segment

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 6
# Readout gate = warm prefill + one decode step; 10s is generous headroom.
GATE_TIMEOUT_SECONDS = 10
TICK_TIMEOUT_SECONDS = 120

# Debounce backstop catches content the gate classified as SKIP.
DEBOUNCE_SECONDS = 45.0
DEBOUNCE_MIN_WORDS = 40
DEBOUNCE_MAX_WORDS = 400

OPENING_DEBOUNCE_SECONDS = 12.0
OPENING_DEBOUNCE_MIN_WORDS = 15

# Single-token logprob readout for the gate (if provider supports)
_GATE_LOGPROBS_OK = True
_GATE_VERDICTS = ("SKIP", "NOTE", "ACT")
_GATE_MIN_VERDICT_MASS = 0.5

# A NOTE verdict with this much SKIP mass on a short utterance is almost always SKIP
_GATE_SKIP_MASS = 0.05
_GATE_SKIP_MASS_MAX_WORDS = 8

# When triggers pile up while a tick runs, the strongest framing wins.
_TICK_REASON_RANK = {
    "debounce": 0,
    "NOTE": 1,
    "ACT": 2,
    "tidy_tick": 3,
    "tidy_command": 4,
}

_TICK_TOOL_ITERATIONS = {"tidy_tick": 16}


class LiveAgentEngine:
    """Drives transcription intake and the agentic loop for one session."""

    def __init__(self, session: LiveSession):
        self.session = session
        self._llm_client = None
        self._audio_lock = asyncio.Lock()  # serialises segment transcription
        self._tick_task: asyncio.Task | None = None
        self._tick_pending: str | None = None

    def _client(self):
        if self._llm_client is None:
            from server.llm_client.client import get_llm_client

            self._llm_client = get_llm_client(timeout=TICK_TIMEOUT_SECONDS)
        return self._llm_client

    def _tick_model(self) -> str:
        """Model for agentic ticks (drafting + tidy commands): PRIMARY.

        Tool-calling quality and clinical extraction accuracy matter more
        than tick latency — matching the chat and reasoning agent loops,
        which also run on primary-class models.
        """
        config = config_manager.get_config()
        return config.get("PRIMARY_MODEL", "")

    def _gate_model(self) -> str:
        """Model for the per-utterance SKIP/NOTE/ACT gate: SECONDARY.

        Trivial single-word classification at high frequency — exactly what
        the secondary model is for (falls back to PRIMARY when unset).
        """
        config = config_manager.get_config()
        return config.get("SECONDARY_MODEL") or config.get("PRIMARY_MODEL", "")

    def _options(self, purpose: str = "tick") -> dict[str, Any]:
        options: dict[str, Any] = {"temperature": 0.0 if purpose == "gate" else 0.1}
        try:
            prompts = config_manager.get_prompts_and_options()
            key = "secondary" if purpose == "gate" else "general"
            saved = prompts["options"].get(key, {}).get("temperature")
            if isinstance(saved, (int, float)):
                options["temperature"] = saved
        except Exception:
            pass
        return options

    async def _chat(
        self, messages, tools=None, max_tokens=None, purpose="tick", logprobs=None
    ) -> dict[str, Any]:
        """Non-streaming chat; thinking stays off via the central default."""
        model = self._gate_model() if purpose == "gate" else self._tick_model()
        options = self._options(purpose)
        if max_tokens:
            options["num_predict"] = max_tokens
        if logprobs:
            options["logprobs"] = True
            options["top_logprobs"] = logprobs

        response = await self._client().chat(
            model=model,
            messages=messages,
            options=options,
            tools=tools,
            stream=False,
        )
        if not isinstance(response, dict):
            raise RuntimeError("Expected non-streaming dict response from LLM client")
        return response

    async def prewarm(self) -> None:
        """Prefill gate and agent prompts; output discarded, errors swallowed."""
        try:
            await self._chat(
                messages=[
                    {"role": "system", "content": GATE_SYSTEM_PROMPT},
                    {"role": "user", "content": "Latest utterance: hello"},
                ],
                max_tokens=1,
                purpose="gate",
            )
            self._ensure_agent_messages()
            await self._chat(
                messages=[
                    self.session.agent_messages[0],
                    {
                        "role": "user",
                        "content": (
                            "New transcript segments:\n(none)\n\n"
                            "(Warm-up probe; do not update any fields.)"
                        ),
                    },
                ],
                tools=self._tools(),
                max_tokens=1,
            )
        except Exception as exc:
            logger.debug("Live session %s: prewarm skipped (%s)", self.session.id, exc)

    async def handle_audio(self, audio_bytes: bytes) -> None:
        """Transcribe one audio segment and feed the gate/agent pipeline."""
        session = self.session
        async with self._audio_lock:
            logger.info("Live session %s: transcribing %d bytes", session.id, len(audio_bytes))
            embed_task = asyncio.create_task(
                asyncio.to_thread(session.speakers.assign, audio_bytes)
            )
            text = ""
            try:
                result = await transcribe_audio(audio_bytes, streaming=True)
            except Exception as exc:
                logger.error("Live session %s: transcription failed: %s", session.id, exc)
                embed_task.cancel()
                await session.emit(
                    {"type": "error", "content": "Transcription failed for one segment."}
                )
                return
            text = str(result.get("text", "")).strip()

            speaker = None
            try:
                speaker = await embed_task
            except Exception as exc:
                logger.debug("Live session %s: diarization failed: %s", session.id, exc)

            if not text:
                logger.info(
                    "Live session %s: transcription returned no text; skipping segment",
                    session.id,
                )
                return
            segment = format_segment(speaker, text)
            async with session.state_lock:
                session.transcript_segments.append(segment)
                session.words_since_draft += len(text.split())
            await session.emit(
                {
                    "type": "transcript",
                    "text": text,
                    "speaker": speaker,
                    "index": len(session.transcript_segments) - 1,
                }
            )

        await self._intake_utterance(segment)

    async def _intake_utterance(self, text: str) -> None:
        session = self.session
        if session.is_ended:
            return

        if session.mode == "tidy":
            self._schedule_tick("tidy_command")
            return

        # Fast path: a tick is already running, so the gate verdict is moot
        # (the next tick reads every un-sent segment). Skipping the call also
        # keeps the gate from contending with the tick for the LLM server.
        if self._tick_task is not None and not self._tick_task.done():
            self._schedule_tick("NOTE")
            return

        verdict = await self._gate_classify(text)
        if verdict in ("NOTE", "ACT"):
            self._schedule_tick(verdict)
        else:
            un_sent = len(session.transcript_segments) - session.segments_sent_to_agent
            if un_sent > 0:
                await session.emit({"type": "backlog", "count": un_sent})
            if self._debounce_due():
                self._schedule_tick("debounce")

    def _debounce_due(self) -> bool:
        session = self.session
        if session.words_since_draft >= DEBOUNCE_MAX_WORDS:
            return True
        if session.segments_sent_to_agent == 0:
            seconds, min_words = OPENING_DEBOUNCE_SECONDS, OPENING_DEBOUNCE_MIN_WORDS
        else:
            seconds, min_words = DEBOUNCE_SECONDS, DEBOUNCE_MIN_WORDS
        elapsed = time.time() - session.last_draft_at
        return elapsed >= seconds and session.words_since_draft >= min_words

    async def _gate_classify(self, text: str) -> str:
        """Cheap SKIP/NOTE/ACT triage of one utterance.

        Prefers a single-token logprob readout,
        """
        global _GATE_LOGPROBS_OK

        session = self.session
        recent = session.transcript_segments[-2:]
        convo = " | ".join(seg for seg in recent[:-1])
        latest = recent[-1] if recent else text
        user_content = (
            f"Earlier: {convo}\nLatest utterance: {latest}"
            if convo
            else f"Latest utterance: {latest}"
        )
        messages = [
            {"role": "system", "content": GATE_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]

        try:
            async with asyncio.timeout(GATE_TIMEOUT_SECONDS):
                verdict = await self._gate_readout(messages, latest)
                if verdict is None:
                    verdict = await self._gate_word(messages)
            return verdict or _gate_fallback()
        except Exception as exc:
            if _GATE_LOGPROBS_OK and _is_logprobs_error(exc):
                _GATE_LOGPROBS_OK = False
                logger.info(
                    "Live session %s: provider rejected logprobs; using "
                    "word gate for this server lifetime.",
                    session.id,
                )
                try:
                    async with asyncio.timeout(GATE_TIMEOUT_SECONDS):
                        return await self._gate_word(messages) or _gate_fallback()
                except Exception:
                    return _gate_fallback()
            fallback = _gate_fallback()
            logger.warning(
                "Live session %s: gate failed (%s); treating as %s",
                session.id,
                exc,
                fallback,
            )
            return fallback

    async def _gate_readout(self, messages, latest: str) -> str | None:
        """Verdict from first-token logprobs, or None when unusable."""
        if not _GATE_LOGPROBS_OK:
            return None
        response = await self._chat(
            messages=messages,
            max_tokens=1,
            purpose="gate",
            logprobs=20,
        )
        scores = _score_verdict_logprobs(response.get("logprobs"))
        if scores is None:
            return None
        total = sum(scores.values())
        if total < _GATE_MIN_VERDICT_MASS:
            return None
        verdict = max(scores, key=lambda verdict: scores[verdict])
        if verdict == "NOTE" and self._skip_mass_rescue(scores, latest):
            return "SKIP"
        return verdict

    def _skip_mass_rescue(self, scores: dict[str, float], latest: str) -> bool:
        """True when a short utterance's SKIP mass outweighs its NOTE argmax."""
        text = split_speaker_segment(latest)[1]
        return (
            scores.get("SKIP", 0.0) >= _GATE_SKIP_MASS
            and len(text.split()) <= _GATE_SKIP_MASS_MAX_WORDS
        )

    async def _gate_word(self, messages) -> str | None:
        """Legacy gate: generate up to 8 tokens and parse the verdict."""
        response = await self._chat(
            messages=messages,
            max_tokens=8,
            purpose="gate",
        )
        content = (response.get("message", {}).get("content") or "").strip().upper()
        for word in reversed(content.split()):
            if word in _GATE_VERDICTS:
                return word
        return None

    def _schedule_tick(self, reason: str) -> None:
        if self._tick_task is not None and not self._tick_task.done():
            pending = self._tick_pending
            if pending is None or _TICK_REASON_RANK.get(reason, 0) > _TICK_REASON_RANK.get(
                pending, 0
            ):
                self._tick_pending = reason
            return
        self._tick_task = asyncio.create_task(self._tick_loop(reason))
        self.session.track_task(self._tick_task)

    async def _tick_loop(self, reason: str | None) -> None:
        while reason and not self.session.is_ended:
            try:
                await self._run_tick(reason)
            except Exception as exc:
                logger.exception("Live session %s: agent tick failed", self.session.id)
                await self.session.emit({"type": "error", "content": f"Agent error: {exc}"})
            reason = self._tick_pending
            self._tick_pending = None

    def _tools(self) -> list[dict[str, Any]]:
        from server.chat.tools import get_tools_definition

        return get_live_tools_definition() + get_tools_definition([], exclude_chat_only=True)

    def _ensure_agent_messages(self) -> None:
        """Initialise the append-only conversation (stable system prefix)."""
        session = self.session
        if not session.agent_messages:
            session.agent_messages.append(
                {
                    "role": "system",
                    "content": build_live_system_prompt(
                        session.patient_context,
                        session.template_fields,
                        pdf_form_templates=_pdf_form_template_names(),
                    ),
                }
            )

    def _field_snapshot(self) -> str:
        session = self.session
        names = {
            field.get("field_key"): field.get("field_name", field.get("field_key"))
            for field in session.template_fields
        }
        lines = []
        for key in names:
            content = session.field_drafts.get(key, "")
            touched = " [clinician-edited]" if key in session.user_touched else ""
            preview = content if len(content) <= 500 else content[:500] + "..."
            lines.append(f"{key}{touched}: {preview or '(empty)'}")
        return "\n".join(lines)

    def _tick_user_message(self, reason: str) -> str:
        session = self.session
        new_segments = session.transcript_segments[session.segments_sent_to_agent :]
        new_text = "\n".join(new_segments) or "(none)"

        if reason == "tidy_tick":
            return build_tidy_tick_message(
                field_snapshot=self._field_snapshot(),
                template_fields=session.template_fields,
                user_touched=sorted(session.user_touched),
            )

        if reason == "tidy_command":
            return (
                f'Clinician said: "{new_segments[-1] if new_segments else ""}"\n\n'
                f"Current note fields:\n{self._field_snapshot()}\n\n"
                "Apply this command with the note tools, then confirm in one line."
            )

        if reason == "ACT":
            framing = (
                "The clinician just made a direct request to you (latest utterance "
                "below). Handle it now — calculate, look up, or stage what was "
                "asked — and capture any new clinical information into the fields."
            )
        elif reason == "NOTE":
            framing = "Significant new clinical information was just spoken. Capture it into the note fields now."
        else:
            framing = "Periodic update: capture new clinical information from the latest segments into the note fields."

        return (
            f"{framing}\n\n"
            f"New transcript segments:\n{new_text}\n\n"
            f"Current note fields:\n{self._field_snapshot()}\n\n"
            "Update the fields with the new information (if any), then reply with "
            "a one-line summary of what changed."
        )

    async def _run_tick(self, reason: str) -> None:
        session = self.session
        self._ensure_agent_messages()

        await session.emit({"type": "agent_state", "state": "working"})
        if reason == "tidy_tick":
            await session.emit({"type": "agent_status", "content": "Tidying note…"})

        async with session.state_lock:
            user_message = {"role": "user", "content": self._tick_user_message(reason)}
            session.agent_messages.append(user_message)
            session.segments_sent_to_agent = len(session.transcript_segments)
            session.words_since_draft = 0
            session.last_draft_at = time.time()
        # The queued-speech indicator clears as soon as a tick consumes it.
        await session.emit({"type": "backlog", "count": 0})

        messages = session.agent_messages
        tools = self._tools()
        final_text = ""

        for _ in range(_TICK_TOOL_ITERATIONS.get(reason, MAX_TOOL_ITERATIONS)):
            response = await self._chat(messages=messages, tools=tools)
            message = response.get("message", {})
            content = message.get("content") or ""

            assistant_message: dict[str, Any] = {"role": "assistant", "content": content}
            tool_calls = message.get("tool_calls") or []
            if tool_calls:
                assistant_message["tool_calls"] = [_clean_tool_call(tc) for tc in tool_calls]
            messages.append(assistant_message)

            if not tool_calls:
                final_text = content
                break

            for tool_call in tool_calls:
                name, args, call_id = _parse_tool_call(tool_call)
                await session.emit({"type": "agent_status", "content": f"Calling tool: {name}"})

                if name in _LIVE_TOOL_NAMES:
                    result = await execute_live_tool(session, name, args)
                    for event in result["events"]:
                        await session.emit(event)
                    tool_content = result["content"]
                else:
                    tool_content, artifacts = await self._run_registry_tool(tool_call, name)
                    for artifact in artifacts:
                        session.staged_artifacts.append(artifact)
                        await session.emit({"type": "artifact_staged", "artifact": artifact})

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call_id,
                        "content": str(tool_content),
                    }
                )
        else:
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "[TOOL_LIMIT_REACHED] Do not call any more tools. Reply "
                        "with a one-line summary of what was completed."
                    ),
                }
            )
            response = await self._chat(messages=messages)
            final_text = response.get("message", {}).get("content") or ""

        if session.mode == "tidy" and reason == "tidy_command":
            await session.emit({"type": "command_result", "content": final_text.strip()[:400]})
        elif final_text.strip():
            await session.emit({"type": "agent_status", "content": final_text.strip()[:200]})
        await session.emit({"type": "agent_state", "state": "listening"})

    async def _run_registry_tool(self, tool_call: dict, name: str) -> tuple[str, list]:
        """Execute a chat-registry tool (incl. MCP) and capture artifacts."""
        from server.chat.tools import execute_tool_streaming

        content = ""
        artifacts: list[dict[str, Any]] = []
        try:
            stream = execute_tool_streaming(
                tool_call=tool_call,
                llm_client=self._client(),
                config=config_manager.get_config(),
                message_list=[],
                context_question_options={},
            )
            async for chunk in stream:
                chunk_type = chunk.get("type")
                if chunk_type == "artifact":
                    artifacts.append(chunk.get("artifact", {}))
                elif chunk_type == "end":
                    function_response = chunk.get("function_response")
                    if isinstance(function_response, dict) and function_response.get("content"):
                        content = str(function_response["content"])
        except Exception as exc:
            logger.error(
                "Live session %s: registry tool '%s' failed: %s", self.session.id, name, exc
            )
            content = f"Error executing tool '{name}': {exc}"
        return content or f"Tool '{name}' returned no content.", artifacts

    def request_tidy(self) -> bool:
        """Schedule a one-off note-consolidation tick (client timer)."""
        if self.session.is_ended:
            return False
        self._schedule_tick("tidy_tick")
        return True

    async def enter_tidy_mode(self) -> None:
        session = self.session
        if session.mode == "tidy":
            return
        async with session.state_lock:
            session.mode = "tidy"
        self._ensure_agent_messages()
        session.agent_messages.append({"role": "user", "content": build_tidy_transition_message()})
        await session.emit({"type": "mode", "mode": "tidy"})


def _is_local_provider() -> bool:
    """True when inference runs on the bundled llama.cpp server."""
    try:
        provider = config_manager.get_config().get("LLM_PROVIDER") or ""
    except Exception:
        return False
    return provider.lower() == "local"


def _pdf_form_template_names() -> list[str]:
    """Names of uploaded PDF form templates (empty when the store is unavailable)."""
    try:
        from server.pdf_forms.storage import PDFFormStore

        return [t["name"] for t in PDFFormStore().list_templates() if t.get("name")]
    except Exception:
        return []


def _score_verdict_logprobs(logprobs: Any) -> dict[str, float] | None:
    """Sum first-token probability mass per verdict from an OpenAI-style
    logprobs payload.
    """
    if not isinstance(logprobs, dict):
        return None
    content = logprobs.get("content")
    if not isinstance(content, list) or not content:
        return None
    first = content[0] if isinstance(content[0], dict) else {}
    entries = list(first.get("top_logprobs") or [])
    if first.get("token") is not None:
        entries.append({"token": first.get("token"), "logprob": first.get("logprob")})

    scores = dict.fromkeys(_GATE_VERDICTS, 0.0)
    seen_tokens: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        token = str(entry.get("token", "")).strip().upper()
        logprob = entry.get("logprob")
        if not token or token in seen_tokens or not isinstance(logprob, (int, float)):
            continue
        seen_tokens.add(token)
        for verdict in _GATE_VERDICTS:
            if token == verdict or verdict.startswith(token):
                scores[verdict] += math.exp(logprob)
                break
    return scores if any(scores.values()) else None


def _is_logprobs_error(exc: Exception) -> bool:
    """Detect provider rejections of the logprobs params (strict clouds)."""
    status = getattr(exc, "status_code", None)
    text = str(exc).lower()
    if status == 400 and "logprob" in text:
        return True
    return "logprob" in text and any(
        marker in text for marker in ("unsupported", "not supported", "invalid")
    )


def _gate_fallback() -> str:
    """Verdict when the gate errors or returns nothing.

    Local: fail open to NOTE — a redundant (coalesced) tick is cheaper than
    missed clinical content. Clouds: fail closed to SKIP (cost control).
    """
    return "NOTE" if _is_local_provider() else "SKIP"


def _parse_tool_call(tool_call: dict) -> tuple[str, dict[str, Any], str]:
    function = tool_call.get("function", {}) if isinstance(tool_call, dict) else {}
    name = function.get("name", "")
    call_id = tool_call.get("id", "") if isinstance(tool_call, dict) else ""
    raw_args = function.get("arguments", "")
    try:
        args = json.loads(raw_args) if isinstance(raw_args, str) and raw_args.strip() else {}
    except json.JSONDecodeError:
        args = {}
    return name, args if isinstance(args, dict) else {}, call_id


def _clean_tool_call(tool_call: dict) -> dict[str, Any]:
    """Normalise a tool call for the message history (non-dict -> dict)."""
    if not isinstance(tool_call, dict):
        tool_call = {
            "id": getattr(tool_call, "id", ""),
            "type": "function",
            "function": {
                "name": getattr(getattr(tool_call, "function", None), "name", ""),
                "arguments": getattr(getattr(tool_call, "function", None), "arguments", ""),
            },
        }
    cleaned = {
        "id": tool_call.get("id", "") or "",
        "type": tool_call.get("type", "function"),
        "function": {
            "name": tool_call.get("function", {}).get("name", ""),
            "arguments": tool_call.get("function", {}).get("arguments", ""),
        },
    }
    if not isinstance(cleaned["function"]["arguments"], str):
        # Some providers return dict arguments.
        cleaned["function"]["arguments"] = json.dumps(cleaned["function"]["arguments"])
    if not cleaned["id"]:
        cleaned["id"] = f"call_{id(tool_call)}"
    return cleaned


_LIVE_TOOL_NAMES = {t["function"]["name"] for t in get_live_tools_definition()}
