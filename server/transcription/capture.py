"""Streaming capture sessions for Ambient and Dictate modes."""

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field

from server.database.config.manager import config_manager
from server.schemas.templates import TemplateField
from server.transcription.intake import intake_utterance
from server.transcription.speakers import SessionSpeakers, format_segment
from server.utils.current_user import CurrentUser, set_current_user

logger = logging.getLogger(__name__)

ENDED_RETENTION_SECONDS = 15 * 60  # keep finished sessions briefly for stop() re-reads
IDLE_TIMEOUT_SECONDS = 2 * 60 * 60  # abandon sessions with no activity for 2h

WARM_MIN_WORDS = 40

# Stop warming once the transcript exceeds this many tokens.
WARM_MAX_TRANSCRIPT_TOKENS = 16_000
WARM_TIMEOUT_SECONDS = 120

FINAL_DRAIN_SECONDS = 30

STREAMING_CAPTURE_KEY = "STREAMING_CAPTURE_ENABLED"
KV_WARMING_KEY = "KV_WARMING_ENABLED"


def _is_local_provider() -> bool:
    config = config_manager.get_config()
    return config.get("LLM_PROVIDER") == "local"


def streaming_capture_enabled() -> bool:
    """Effective streaming-capture default: explicit setting wins, else on
    for the bundled local stack (desktop), off for remote endpoints."""
    config = config_manager.get_config()
    value = config.get(STREAMING_CAPTURE_KEY)
    if isinstance(value, bool):
        return value
    return _is_local_provider()


def kv_warming_enabled() -> bool:
    """KV-cache warming: on by default for the bundled local provider only."""
    value = config_manager.get_config().get(KV_WARMING_KEY)
    if isinstance(value, bool):
        return value
    return _is_local_provider()


@dataclass
class CaptureSession:
    """In-memory state for one ambient/dictate streaming capture."""

    id: str
    owner_user: CurrentUser = field(repr=False, compare=False)
    mode: str  # "ambient" | "dictate"
    template_key: str | None
    template_fields: list[TemplateField]
    patient_context: dict[str, str | None]
    primary_condition: str | None
    note_id: int | None = None
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    ended_at: float | None = None
    transcript_segments: list[str] = field(default_factory=list)

    # Running cl100k token count of the transcript.
    transcript_tokens: int = 0

    # Cumulative ASR engine time
    stt_seconds: float = 0.0

    failed_segments: int = 0
    words_since_warm: int = 0

    speakers: SessionSpeakers | None = None
    audio_lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False, compare=False)
    warm_task: asyncio.Task | None = field(default=None, repr=False, compare=False)
    _tasks: set = field(default_factory=set, repr=False, compare=False)
    # Set by the stop route; a repeat stop returns it unchanged.
    stop_result: dict | None = field(default=None, repr=False, compare=False)

    def touch(self) -> None:
        self.last_activity = time.time()

    def end(self) -> None:
        if self.ended_at is None:
            self.ended_at = time.time()

    @property
    def is_ended(self) -> bool:
        return self.ended_at is not None

    @property
    def is_ambient(self) -> bool:
        return self.mode == "ambient"

    def track_task(self, task: asyncio.Task) -> None:
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    def transcript_text(self) -> str:
        return "\n".join(self.transcript_segments)


class CaptureManager:
    """Registry of active capture sessions with lazy TTL pruning."""

    def __init__(self) -> None:
        self._sessions: dict[str, CaptureSession] = {}

    def _prune(self) -> None:
        now = time.time()
        stale = [
            sid
            for sid, session in self._sessions.items()
            if (
                session.is_ended
                and session.ended_at is not None
                and now - session.ended_at > ENDED_RETENTION_SECONDS
            )
            or (now - session.last_activity > IDLE_TIMEOUT_SECONDS)
        ]
        for sid in stale:
            logger.info("Pruning capture session %s (idle/ended)", sid)
            del self._sessions[sid]

    def create(
        self,
        owner_user: CurrentUser,
        mode: str,
        template_key: str | None,
        template_fields: list[TemplateField],
        patient_context: dict[str, str | None],
        primary_condition: str | None = None,
        note_id: int | None = None,
    ) -> CaptureSession:
        self._prune()
        session = CaptureSession(
            id=uuid.uuid4().hex,
            owner_user=owner_user,
            mode=mode,
            template_key=template_key,
            template_fields=template_fields,
            patient_context=patient_context,
            primary_condition=primary_condition,
            note_id=note_id,
            speakers=SessionSpeakers() if mode == "ambient" else None,
        )
        self._sessions[session.id] = session
        return session

    def get(self, session_id: str) -> CaptureSession | None:
        self._prune()
        session = self._sessions.get(session_id)
        if session is not None:
            session.touch()
        return session


capture_manager = CaptureManager()


async def handle_audio(session: CaptureSession, audio_bytes: bytes) -> None:
    """Intake one utterance: transcribe, label (ambient), append, maybe warm."""
    if session.is_ended:
        return
    set_current_user(session.owner_user)
    session.touch()
    async with session.audio_lock:
        try:
            speaker, text, stt_duration = await intake_utterance(audio_bytes, session.speakers)
        except Exception as exc:
            session.failed_segments += 1
            logger.error("Capture session %s: transcription failed: %s", session.id, exc)
            return
        text = text.strip()
        if not text:
            logger.info(
                "Capture session %s: transcription returned no text; skipping segment",
                session.id,
            )
            return
        segment = format_segment(speaker, text)
        session.transcript_segments.append(segment)
        session.words_since_warm += len(text.split())
        session.stt_seconds += stt_duration
        session.transcript_tokens += _count_tokens(segment)

    if _warming_due(session):
        _schedule_warm(session)


def _count_tokens(text: str) -> int:
    """Token count via the shared cl100k helper."""
    from server.rag.chunking_utils import openai_token_count

    return openai_token_count(text)


def _warming_due(session: CaptureSession) -> bool:
    if session.is_ended:
        return False
    if not kv_warming_enabled():
        return False
    if session.words_since_warm < WARM_MIN_WORDS:
        return False
    return session.transcript_tokens <= WARM_MAX_TRANSCRIPT_TOKENS


def _schedule_warm(session: CaptureSession) -> None:
    if session.warm_task is not None and not session.warm_task.done():
        # A warm is in flight; leave the word counter so the next utterance retries.
        return
    session.words_since_warm = 0
    session.warm_task = asyncio.create_task(_warm(session))
    session.track_task(session.warm_task)


async def _warm(session: CaptureSession) -> None:
    """Prefill the extraction prompt prefix with the transcript so far."""
    set_current_user(session.owner_user)
    try:
        from server.llm_client.client import get_llm_client
        from server.transcription.text import build_extraction_messages

        # KV prefix dies at the first differing FIELDS block if not byte identical.
        fields = [f for f in session.template_fields if not f.persistent]

        config = config_manager.get_config()
        messages = build_extraction_messages(
            session.transcript_text(),
            fields,
            session.patient_context,
            is_ambient=session.is_ambient,
            primary_condition=session.primary_condition,
        )
        client = get_llm_client(timeout=WARM_TIMEOUT_SECONDS)
        options: dict = {
            "temperature": 0.0,
            "num_predict": 1,  # one decode step, discarded
        }
        if _is_local_provider():
            options["extra_body"] = {"cache_prompt": True}
        await client.chat(
            model=config["PRIMARY_MODEL"],
            messages=messages,
            options=options,
        )
    except Exception as exc:
        logger.debug("Capture session %s: warm-up skipped (%s)", session.id, exc)


async def drain(session: CaptureSession, timeout: float = FINAL_DRAIN_SECONDS) -> None:
    """Wait (bounded) for in-flight utterance/warm tasks to settle."""
    pending = [task for task in session._tasks if not task.done()]
    if pending:
        done, still_pending = await asyncio.wait(pending, timeout=timeout)
        if still_pending:
            logger.warning(
                "Capture session %s: %d task(s) still running after drain",
                session.id,
                len(still_pending),
            )


async def finalize(session: CaptureSession) -> dict:
    """Run the regular batch pipeline over the captured transcript."""
    from server.transcription.text import process_transcription

    set_current_user(session.owner_user)
    transcript_text = session.transcript_text()
    processing_result = await process_transcription(
        transcript_text=transcript_text,
        template_fields=session.template_fields,
        patient_context=session.patient_context,
        is_ambient=session.is_ambient,
        primary_condition=session.primary_condition,
    )
    return {
        "fields": dict(processing_result["fields"]),
        "rawTranscription": transcript_text,
        "transcriptionDuration": round(session.stt_seconds, 2),
        "processDuration": float(processing_result["process_duration"]),
    }
