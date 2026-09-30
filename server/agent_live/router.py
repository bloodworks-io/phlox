"""HTTP + SSE API for the live scribe agent.

Endpoints (all authenticated via the existing Bearer-token middleware;
sessions are owned by the creating user in multi-user deployments):

  POST /sessions                      start a live session
  POST /sessions/{sid}/audio          upload one utterance-bounded audio segment
  GET  /sessions/{sid}/events         SSE stream of live events
  POST /sessions/{sid}/feedback       push clinician note edits back to the agent
  POST /sessions/{sid}/tidy           request a one-off note-consolidation tick
  POST /sessions/{sid}/mode           switch mode (live -> tidy)
  POST /sessions/{sid}/stop           end the session, return final state
"""

import asyncio
import json
import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from server.agent_live.engine import LiveAgentEngine
from server.agent_live.session import LiveSession, session_manager
from server.transcription.speakers import split_speaker_segment
from server.utils.current_user import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

SSE_KEEPALIVE_SECONDS = 15

# Covers slow prefill and cold model loads without blocking session creation.
PREWARM_TIMEOUT_SECONDS = 60


class LiveStartRequest(BaseModel):
    note_id: int | None = None
    template_key: str | None = None
    template_data: dict[str, str] = Field(default_factory=dict)
    patient: dict[str, str] = Field(default_factory=dict)


class LiveFeedbackRequest(BaseModel):
    fields: dict[str, str] = Field(default_factory=dict)


class LiveModeRequest(BaseModel):
    mode: str = Field(pattern="^(live|tidy)$")


class LiveJobItem(BaseModel):
    text: str
    checked: bool = True


class LiveJobsPushRequest(BaseModel):
    """Extracted job list pushed from the client's standard extract-jobs flow."""

    jobs: list[LiveJobItem]


def _current_owner(request: Request) -> str:
    return getattr(request.state, "user", "local")


def _get_owned_session(session_id: str, request: Request) -> LiveSession:
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Live session not found")
    if session.owner_user.username != _current_owner(request):
        raise HTTPException(status_code=403, detail="Not your live session")
    return session


def _final_state(session: LiveSession) -> dict:
    return {
        "session_id": session.id,
        "mode": session.mode,
        "fields": dict(session.field_drafts),
        "transcript": "\n".join(session.transcript_segments),
        "artifacts": list(session.staged_artifacts),
        "jobs": list(session.staged_jobs),
    }


@router.post("/sessions")
async def start_session(body: LiveStartRequest):
    user = get_current_user()
    if user is None:
        raise HTTPException(status_code=401, detail="No authenticated user for live session")
    template_fields: list[dict] = []
    if body.template_key:
        from server.database.repositories.templates import get_template_fields

        raw_fields = get_template_fields(body.template_key)
        template_fields = [
            field.model_dump() if hasattr(field, "model_dump") else field for field in raw_fields
        ]

    session = session_manager.create(
        owner_user=user,
        patient_context=body.patient,
        template_key=body.template_key,
        template_fields=template_fields,
        initial_fields=body.template_data,
        note_id=body.note_id,
    )
    session.engine = LiveAgentEngine(session)
    # Awaited so the first tick doesn't pay the prefill; the client holds its
    # loading state until this POST resolves.
    try:
        await asyncio.wait_for(session.engine.prewarm(), PREWARM_TIMEOUT_SECONDS)
    except Exception as exc:
        logger.warning(
            "Live session %s: prewarm incomplete; starting anyway (%s)",
            session.id,
            exc,
        )
    logger.info("Live session %s started (owner=%s)", session.id, session.owner_user.username)
    return {"session_id": session.id}


@router.post("/sessions/{session_id}/audio")
async def upload_audio(session_id: str, request: Request, file: UploadFile = File(...)):
    session = _get_owned_session(session_id, request)
    if session.is_ended:
        raise HTTPException(status_code=409, detail="Live session already ended")

    audio_bytes = await file.read()
    session.track_task(asyncio.create_task(session.engine.handle_audio(audio_bytes)))
    return {"accepted": True}


@router.get("/sessions/{session_id}/events")
async def stream_events(session_id: str, request: Request):
    session = _get_owned_session(session_id, request)

    async def event_stream():
        queue = session.subscribe()
        try:
            yield f"data: {json.dumps({'type': 'start', 'mode': session.mode})}\n\n"
            for index, segment in enumerate(session.transcript_segments):
                speaker, text = split_speaker_segment(segment)
                yield (
                    f"data: {json.dumps({'type': 'transcript', 'text': text, 'speaker': speaker, 'index': index})}\n\n"
                )
            for key, content in session.field_drafts.items():
                # Replay as field_state so reconnect catch-up doesn't flash every field.
                yield f"data: {json.dumps({'type': 'field_state', 'field_key': key, 'content': content})}\n\n"
            for artifact in session.staged_artifacts:
                yield f"data: {json.dumps({'type': 'artifact_staged', 'artifact': artifact})}\n\n"
            if session.mode == "tidy":
                yield f"data: {json.dumps({'type': 'mode', 'mode': 'tidy'})}\n\n"

            while True:
                if session.is_ended:
                    yield f"data: {json.dumps({'type': 'end'})}\n\n"
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=SSE_KEEPALIVE_SECONDS)
                except TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") == "end":
                    break
        finally:
            session.unsubscribe(queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/sessions/{session_id}/feedback")
async def push_feedback(session_id: str, body: LiveFeedbackRequest, request: Request):
    session = _get_owned_session(session_id, request)
    valid_keys = {field.get("field_key") for field in session.template_fields}

    async with session.state_lock:
        for key, content in body.fields.items():
            if key not in valid_keys:
                continue
            # Differing content means the clinician edited it — their edit wins.
            if content != session.field_drafts.get(key):
                session.field_drafts[key] = content
                session.user_touched.add(key)
    return {"ok": True}


@router.post("/sessions/{session_id}/jobs")
async def push_jobs(session_id: str, body: LiveJobsPushRequest, request: Request):
    """Seed the session's job list from the client's extract-jobs pipeline.

    The agent curates this list by voice (set_jobs); generation always goes
    through the standard extraction endpoint, never the agent itself.
    """
    session = _get_owned_session(session_id, request)
    async with session.state_lock:
        session.staged_jobs = [job.model_dump() for job in body.jobs]
    return {"ok": True, "count": len(session.staged_jobs)}


@router.post("/sessions/{session_id}/tidy")
async def request_tidy(session_id: str, request: Request):
    """Schedule a one-off note-consolidation tick."""
    session = _get_owned_session(session_id, request)
    if session.is_ended:
        raise HTTPException(status_code=409, detail="Live session already ended")
    scheduled = session.engine.request_tidy()
    return {"ok": True, "scheduled": scheduled}


@router.post("/sessions/{session_id}/mode")
async def set_mode(session_id: str, body: LiveModeRequest, request: Request):
    session = _get_owned_session(session_id, request)
    if body.mode == "tidy":
        await session.engine.enter_tidy_mode()
        return {"ok": True, "mode": "tidy"}
    return {"ok": True, "mode": session.mode}


@router.post("/sessions/{session_id}/stop")
async def stop_session(session_id: str, request: Request):
    session = _get_owned_session(session_id, request)
    async with session.state_lock:
        already_ended = session.is_ended
        session.end()
    if not already_ended:
        await session.emit({"type": "end"})
        logger.info("Live session %s stopped", session.id)
    return _final_state(session)
