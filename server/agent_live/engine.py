"""Live scribe agent engine.

Owns the per-session hot loop:
  audio segment -> transcribe -> gate (SKIP/NOTE/ACT) -> agent tick
                                              ^ debounce backstop

The agent tick is a free-form tool-calling loop (NO JSON grammar) on
SECONDARY_MODEL with thinking disabled by default. The conversation is
append-only so provider prompt caches stay valid across ticks.
"""

import asyncio
import json
import logging
import time
from typing import Any

from server.agent_live.prompts import (
    GATE_SYSTEM_PROMPT,
    build_live_system_prompt,
    build_tidy_transition_message,
)
from server.agent_live.session import LiveSession
from server.agent_live.tools import execute_live_tool, get_live_tools_definition
from server.database.config.manager import config_manager
from server.transcription.audio import transcribe_audio

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 6
GATE_TIMEOUT_SECONDS = 20
TICK_TIMEOUT_SECONDS = 120

# Debounce backstop catches content the gate classified as SKIP.
DEBOUNCE_SECONDS = 45.0
DEBOUNCE_MIN_WORDS = 40
DEBOUNCE_MAX_WORDS = 400

# Honoured by llama.cpp/vLLM/Ollama; strict clouds 400 → self-heal in _chat.
_REASONING_EFFORT_OK = True


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
        options: dict[str, Any] = {"temperature": 0.1}
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
        self, messages, tools=None, max_tokens=None, purpose="tick"
    ) -> dict[str, Any]:
        """Non-streaming chat with thinking off and 400 self-healing."""
        global _REASONING_EFFORT_OK

        model = self._gate_model() if purpose == "gate" else self._tick_model()
        options = self._options(purpose)
        if max_tokens:
            options["num_predict"] = max_tokens
        if _REASONING_EFFORT_OK:
            options["extra_body"] = {"reasoning_effort": "none"}

        try:
            response = await self._client().chat(
                model=model,
                messages=messages,
                options=options,
                tools=tools,
                stream=False,
            )
        except Exception as exc:
            if _REASONING_EFFORT_OK and _is_unsupported_param_error(exc):
                logger.info(
                    "Live agent: provider rejected reasoning_effort; "
                    "disabling for this server lifetime and retrying."
                )
                _REASONING_EFFORT_OK = False
                options.pop("extra_body", None)
                response = await self._client().chat(
                    model=model,
                    messages=messages,
                    options=options,
                    tools=tools,
                    stream=False,
                )
            else:
                raise
        if not isinstance(response, dict):
            raise RuntimeError("Expected non-streaming dict response from LLM client")
        return response

    async def handle_audio(self, audio_bytes: bytes) -> None:
        """Transcribe one audio segment and feed the gate/agent pipeline."""
        session = self.session
        async with self._audio_lock:
            try:
                result = await transcribe_audio(audio_bytes)
            except Exception as exc:
                logger.error("Live session %s: transcription failed: %s", session.id, exc)
                await session.emit(
                    {"type": "error", "content": "Transcription failed for one segment."}
                )
                return
            text = str(result.get("text", "")).strip()
            if not text:
                return
            async with session.state_lock:
                session.transcript_segments.append(text)
                session.words_since_draft += len(text.split())
            await session.emit(
                {"type": "transcript", "text": text, "index": len(session.transcript_segments) - 1}
            )

        await self._intake_utterance(text)

    async def _intake_utterance(self, text: str) -> None:
        session = self.session
        if session.is_ended:
            return

        if session.mode == "tidy":
            self._schedule_tick("tidy_command")
            return

        verdict = await self._gate_classify(text)
        if verdict in ("NOTE", "ACT"):
            self._schedule_tick(verdict)
        elif self._debounce_due():
            self._schedule_tick("debounce")

    def _debounce_due(self) -> bool:
        session = self.session
        if session.words_since_draft >= DEBOUNCE_MAX_WORDS:
            return True
        elapsed = time.time() - session.last_draft_at
        return (
            elapsed >= DEBOUNCE_SECONDS
            and session.words_since_draft >= DEBOUNCE_MIN_WORDS
        )

    async def _gate_classify(self, text: str) -> str:
        """Cheap SKIP/NOTE/ACT triage of one utterance. Fails closed to SKIP."""
        session = self.session
        recent = session.transcript_segments[-2:]
        convo = " | ".join(seg for seg in recent[:-1])
        latest = recent[-1] if recent else text
        user_content = f"Earlier: {convo}\nLatest utterance: {latest}" if convo else f"Latest utterance: {latest}"

        try:
            async with asyncio.timeout(GATE_TIMEOUT_SECONDS):
                response = await self._chat(
                    messages=[
                        {"role": "system", "content": GATE_SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    max_tokens=8,
                    purpose="gate",
                )
            content = (response.get("message", {}).get("content") or "").strip().upper()
            for word in reversed(content.split()):
                if word in ("SKIP", "NOTE", "ACT"):
                    return word
            return "SKIP"
        except Exception as exc:
            logger.warning("Live session %s: gate failed (%s); treating as SKIP", session.id, exc)
            return "SKIP"

    def _schedule_tick(self, reason: str) -> None:
        if self._tick_task is not None and not self._tick_task.done():
            self._tick_pending = reason
            return
        self._tick_task = asyncio.create_task(self._tick_loop(reason))
        self.session.track_task(self._tick_task)

    async def _tick_loop(self, reason: str) -> None:
        while reason and not self.session.is_ended:
            try:
                await self._run_tick(reason)
            except Exception as exc:
                logger.exception("Live session %s: agent tick failed", self.session.id)
                await self.session.emit(
                    {"type": "error", "content": f"Agent error: {exc}"}
                )
            reason = self._tick_pending
            self._tick_pending = None

    def _tools(self) -> list[dict[str, Any]]:
        from server.chat.tools import get_tools_definition

        return get_live_tools_definition() + get_tools_definition(
            [], exclude_chat_only=True
        )

    def _ensure_agent_messages(self) -> None:
        """Initialise the append-only conversation (stable system prefix)."""
        session = self.session
        if not session.agent_messages:
            session.agent_messages.append(
                {
                    "role": "system",
                    "content": build_live_system_prompt(
                        session.patient_context, session.template_fields
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

        if reason == "tidy_command":
            return (
                f"Clinician said: \"{new_segments[-1] if new_segments else ''}\"\n\n"
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

        async with session.state_lock:
            user_message = {"role": "user", "content": self._tick_user_message(reason)}
            session.agent_messages.append(user_message)
            session.segments_sent_to_agent = len(session.transcript_segments)
            session.words_since_draft = 0
            session.last_draft_at = time.time()

        messages = session.agent_messages
        tools = self._tools()
        final_text = ""

        for _ in range(MAX_TOOL_ITERATIONS):
            response = await self._chat(messages=messages, tools=tools)
            message = response.get("message", {})
            content = message.get("content") or ""

            assistant_message: dict[str, Any] = {"role": "assistant", "content": content}
            tool_calls = message.get("tool_calls") or []
            if tool_calls:
                assistant_message["tool_calls"] = [
                    _clean_tool_call(tc) for tc in tool_calls
                ]
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
                    tool_content, artifacts = await self._run_registry_tool(
                        tool_call, name
                    )
                    for artifact in artifacts:
                        session.staged_artifacts.append(artifact)
                        await session.emit(
                            {"type": "artifact_staged", "artifact": artifact}
                        )

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
            await session.emit(
                {"type": "command_result", "content": final_text.strip()[:400]}
            )
        elif final_text.strip():
            await session.emit(
                {"type": "agent_status", "content": final_text.strip()[:200]}
            )
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
                    if isinstance(function_response, dict) and function_response.get(
                        "content"
                    ):
                        content = str(function_response["content"])
        except Exception as exc:
            logger.error("Live session %s: registry tool '%s' failed: %s", self.session.id, name, exc)
            content = f"Error executing tool '{name}': {exc}"
        return content or f"Tool '{name}' returned no content.", artifacts

    async def enter_tidy_mode(self) -> None:
        session = self.session
        if session.mode == "tidy":
            return
        async with session.state_lock:
            session.mode = "tidy"
        self._ensure_agent_messages()
        session.agent_messages.append(
            {"role": "user", "content": build_tidy_transition_message()}
        )
        await session.emit({"type": "mode", "mode": "tidy"})


def _is_unsupported_param_error(exc: Exception) -> bool:
    """Detect strict-provider 400s about unsupported params (e.g. reasoning_effort)."""
    status = getattr(exc, "status_code", None)
    text = str(exc).lower()
    if status == 400 and "reasoning_effort" in text:
        return True
    return "unsupported parameter" in text and "reasoning" in text


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
                "arguments": getattr(
                    getattr(tool_call, "function", None), "arguments", ""
                ),
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
        cleaned["function"]["arguments"] = json.dumps(
            cleaned["function"]["arguments"]
        )
    if not cleaned["id"]:
        cleaned["id"] = f"call_{id(tool_call)}"
    return cleaned


_LIVE_TOOL_NAMES = {
    "get_note_fields",
    "update_note_field",
    "append_to_field",
    "remove_from_field",
    "stage_artifact",
    "get_jobs",
    "set_jobs",
    "wrap_up",
}
