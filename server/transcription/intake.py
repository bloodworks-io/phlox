"""Shared utterance intake for the streaming capture paths."""

import asyncio
import logging

from server.transcription.audio import transcribe_audio

logger = logging.getLogger(__name__)


async def intake_utterance(audio_bytes: bytes, speakers=None) -> tuple[str | None, str, float]:
    """Transcribe one utterance and resolve its speaker label."""
    embed_task = None
    if speakers is not None:
        embed_task = asyncio.create_task(asyncio.to_thread(speakers.assign, audio_bytes))
    try:
        result = await transcribe_audio(audio_bytes, streaming=True)
    except Exception:
        if embed_task is not None:
            embed_task.cancel()
        raise
    text = str(result.get("text", "")).strip()
    try:
        duration = float(result.get("transcriptionDuration", 0.0) or 0.0)
    except (TypeError, ValueError):
        duration = 0.0

    speaker = None
    if embed_task is not None:
        try:
            speaker = await embed_task
        except Exception as exc:
            logger.debug("Diarization failed for one utterance: %s", exc)
    return speaker, text, duration
