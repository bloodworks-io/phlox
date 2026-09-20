"""Best-effort speaker diarization for live utterance streams."""

import logging
import math
import os
import re
import threading
import wave
from array import array
from pathlib import Path

logger = logging.getLogger(__name__)

# "S1: ", "S12: " ... at the start of a transcript line.
SPEAKER_LINE_RE = re.compile(r"^(S[1-9]\d*):\s")

SAMPLE_RATE = 16000

DEFAULT_THRESHOLD = 0.55
MIN_UTTERANCE_SECONDS = 0.8
MAX_SPEAKERS = 4

MODEL_FILENAME = "campplus-common.onnx"


def format_segment(speaker: str | None, text: str) -> str:
    """Prefix a transcript line with the speaker label, if any."""
    return f"{speaker}: {text}" if speaker else text


def split_speaker_segment(segment: str) -> tuple[str | None, str]:
    """Split a stored transcript line into (speaker | None, text)."""
    match = SPEAKER_LINE_RE.match(segment)
    if match:
        return match.group(1), segment[match.end() :]
    return None, segment


def has_speaker_prefixes(text: str) -> bool:
    """True when any line of the text carries a speaker label."""
    return any(SPEAKER_LINE_RE.match(line) for line in text.splitlines())


def strip_speaker_prefixes(text: str) -> str:
    """Remove speaker labels from every line of a transcript."""
    return "\n".join(split_speaker_segment(line)[1] for line in text.splitlines())


def speaker_legend_hint(text: str) -> str:
    """Prompt legend explaining the labels, when the transcript has any.

    Kept quote-free so small models do not echo examples back.
    """
    if not has_speaker_prefixes(text):
        return ""
    return (
        "Transcript lines are prefixed with speaker labels like S1 or S2 from "
        "best-effort automatic diarization; the labels can be wrong or missing. "
        "Use them only as hints about who said what and never include the "
        "labels in your output."
    )


def wav_bytes_to_samples(data: bytes) -> tuple[list[float], int] | None:
    """Parse 16-bit PCM mono WAV bytes to (float samples in [-1, 1], rate)."""
    try:
        with wave.open(__import__("io").BytesIO(data), "rb") as wav:
            if (
                wav.getsampwidth() != 2
                or wav.getnchannels() != 1
                or wav.getframerate() != SAMPLE_RATE
            ):
                return None
            pcm = array("h", wav.readframes(wav.getnframes()))
    except Exception:
        return None
    return [sample / 32768.0 for sample in pcm], SAMPLE_RATE


def _resolve_model_path() -> Path | None:
    """Locate the CAM++ ONNX file: env override, then packaged locations."""
    env_path = os.environ.get("PHLOX_SPEAKER_MODEL", "").strip()
    if env_path:
        path = Path(env_path)
        return path if path.is_file() else None

    package_dir = Path(__file__).resolve().parent
    candidates = [
        package_dir.parent / "assets" / "models" / MODEL_FILENAME,
        Path.cwd() / "server" / "assets" / "models" / MODEL_FILENAME,
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


class Diarizer:
    """Singleton wrapper around the sherpa-onnx CAM++ embedding extractor."""

    def __init__(self) -> None:
        self._extractor = None
        self._failed = False
        self._lock = threading.Lock()

    def _load(self):
        if self._extractor is not None or self._failed:
            return self._extractor
        with self._lock:
            if self._extractor is not None or self._failed:
                return self._extractor
            try:
                import sherpa_onnx

                model_path = _resolve_model_path()
                if model_path is None:
                    raise FileNotFoundError(f"speaker embedding model not found ({MODEL_FILENAME})")
                config = sherpa_onnx.SpeakerEmbeddingExtractorConfig(
                    model=str(model_path),
                    num_threads=1,
                    debug=False,
                    provider="cpu",
                )
                if not config.validate():
                    raise ValueError("invalid SpeakerEmbeddingExtractorConfig")
                self._extractor = sherpa_onnx.SpeakerEmbeddingExtractor(config)
                logger.info("Speaker diarization ready (model=%s)", model_path)
            except Exception as exc:
                self._failed = True
                logger.info("Speaker diarization unavailable: %s", exc)
                return None
        return self._extractor

    def embed(self, samples: list[float]) -> list[float] | None:
        """CAM++ embedding for one utterance of 16 kHz floats, or None."""
        extractor = self._load()
        if extractor is None:
            return None
        try:
            with self._lock:
                stream = extractor.create_stream()
                stream.accept_waveform(SAMPLE_RATE, samples)
                stream.input_finished()
                embedding = extractor.compute(stream)
            return [float(value) for value in embedding] if embedding else None
        except Exception as exc:
            logger.warning("Speaker embedding failed: %s", exc)
            return None


_diarizer: Diarizer | None = None
_diarizer_lock = threading.Lock()


def get_diarizer() -> Diarizer:
    global _diarizer
    with _diarizer_lock:
        if _diarizer is None:
            _diarizer = Diarizer()
        return _diarizer


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    norm = math.sqrt(sum(x * x for x in a) * sum(y * y for y in b))
    return dot / norm if norm else 0.0


def _mean(vectors: list[list[float]]) -> list[float]:
    count = len(vectors)
    return [sum(v[i] for v in vectors) / count for i in range(len(vectors[0]))]


class SessionSpeakers:
    """Per-session anonymous speaker registry via centroid matching."""

    def __init__(
        self,
        threshold: float = DEFAULT_THRESHOLD,
        min_duration: float = MIN_UTTERANCE_SECONDS,
        max_speakers: int = MAX_SPEAKERS,
    ) -> None:
        self.threshold = threshold
        self.min_duration = min_duration
        self.max_speakers = max_speakers
        self._embeddings: dict[str, list[list[float]]] = {}
        self._centroids: dict[str, list[float]] = {}
        self._last_label: str | None = None

    @property
    def speaker_count(self) -> int:
        return len(self._centroids)

    def assign(self, audio_bytes: bytes) -> str | None:
        """Label one utterance, or None when diarization cannot decide."""
        parsed = wav_bytes_to_samples(audio_bytes)
        if parsed is None:
            return self._inherit()
        samples, _ = parsed
        if len(samples) < self.min_duration * SAMPLE_RATE:
            return self._inherit()

        embedding = get_diarizer().embed(samples)
        if embedding is None:
            return self._inherit()

        best_label, score = self._best_match(embedding)
        label: str
        if score >= self.threshold and best_label is not None:
            label = best_label
        elif len(self._centroids) < self.max_speakers:
            label = f"S{len(self._centroids) + 1}"
        else:
            # Cap reached: keep the closest existing centroid (best effort)
            # rather than minting an implausible fifth speaker. The registry
            # is never empty here (cap >= 1), so the fallback is safe.
            label = best_label or f"S{len(self._centroids) + 1}"
        self._record(label, embedding)
        self._last_label = label
        return label

    def _inherit(self) -> str | None:
        """Short/unusable audio: assume the previous speaker said it."""
        return self._last_label

    def _best_match(self, embedding: list[float]) -> tuple[str | None, float]:
        best_label, best_score = None, -1.0
        for label, centroid in self._centroids.items():
            score = _cosine(embedding, centroid)
            if score > best_score:
                best_label, best_score = label, score
        return best_label, best_score

    def _record(self, label: str, embedding: list[float]) -> None:
        embeddings = self._embeddings.setdefault(label, [])
        embeddings.append(embedding)
        self._centroids[label] = _mean(embeddings)


# Default session registry factory for LiveSession.
def create_session_speakers() -> SessionSpeakers:
    return SessionSpeakers()
