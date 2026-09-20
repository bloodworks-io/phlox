"""Live agent session state and lifecycle management."""

import asyncio
import contextlib
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from server.transcription.speakers import SessionSpeakers

logger = logging.getLogger(__name__)

ENDED_RETENTION_SECONDS = 30 * 60  # keep finished sessions briefly for stop() re-reads
IDLE_TIMEOUT_SECONDS = 4 * 60 * 60  # abandon sessions with no activity for 4h

_EVENT_QUEUE_MAX = 200


@dataclass
class LiveSession:
    """In-memory state for one live scribe session."""

    id: str
    owner: str
    patient_context: dict[str, Any]
    template_key: str | None
    template_fields: list[dict[str, Any]]
    note_id: int | None = None
    mode: str = "live"  # "live" (ambient consultation) | "tidy" (post-visit commands)
    transcript_segments: list[str] = field(default_factory=list)
    # Best-effort anonymous speaker registry (S1, S2, ...) for live audio.
    speakers: SessionSpeakers = field(default_factory=SessionSpeakers)
    field_drafts: dict[str, str] = field(default_factory=dict)
    user_touched: set[str] = field(default_factory=set)
    # Spoken format overrides: "list" | "narrative"; absent = template style.
    field_formats: dict[str, str] = field(default_factory=dict)
    staged_artifacts: list[dict[str, Any]] = field(default_factory=list)
    # Seeded by the client's extract-jobs pipeline; voice-curated via set_jobs.
    staged_jobs: list[dict[str, Any]] = field(default_factory=list)
    # Append-only; stable system prefix keeps provider prompt caches valid.
    agent_messages: list[dict[str, Any]] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    ended_at: float | None = None
    last_draft_at: float = field(default_factory=time.time)
    words_since_draft: int = 0
    segments_sent_to_agent: int = 0

    def touch(self) -> None:
        self.last_activity = time.time()

    def end(self) -> None:
        if self.ended_at is None:
            self.ended_at = time.time()

    @property
    def is_ended(self) -> bool:
        return self.ended_at is not None

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=_EVENT_QUEUE_MAX)
        self._subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        with contextlib.suppress(ValueError):
            self._subscribers.remove(queue)

    async def emit(self, event: dict[str, Any]) -> None:
        """Fan an event out to all SSE subscribers (drops slow consumers)."""
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("Live session %s: slow SSE consumer dropped", self.id)
                self.unsubscribe(queue)

    def emit_nowait(self, event: dict[str, Any]) -> None:
        """Synchronous emit for use inside non-async tool executors."""
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("Live session %s: slow SSE consumer dropped", self.id)
                self.unsubscribe(queue)

    state_lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False, compare=False)
    engine: Any = field(default=None, repr=False, compare=False)
    _subscribers: list = field(default_factory=list, repr=False, compare=False)
    _tasks: set = field(default_factory=set, repr=False, compare=False)

    def track_task(self, task: asyncio.Task) -> None:
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)


class SessionManager:
    """Registry of active live sessions with lazy TTL pruning."""

    def __init__(self) -> None:
        self._sessions: dict[str, LiveSession] = {}

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
            logger.info("Pruning live session %s (idle/ended)", sid)
            del self._sessions[sid]

    def create(
        self,
        owner: str,
        patient_context: dict[str, Any],
        template_key: str | None,
        template_fields: list[dict[str, Any]],
        initial_fields: dict[str, str] | None = None,
        note_id: int | None = None,
    ) -> LiveSession:
        self._prune()
        session = LiveSession(
            id=uuid.uuid4().hex,
            owner=owner,
            patient_context=patient_context,
            template_key=template_key,
            template_fields=template_fields,
            note_id=note_id,
        )
        if initial_fields:
            session.field_drafts = {k: str(v) for k, v in initial_fields.items() if v is not None}
        self._sessions[session.id] = session
        return session

    def get(self, session_id: str) -> LiveSession | None:
        self._prune()
        session = self._sessions.get(session_id)
        if session is not None:
            session.touch()
        return session

    def remove(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)


session_manager = SessionManager()
