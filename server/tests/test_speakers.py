"""Tests for best-effort speaker diarization (centroid matching, S-labels)."""

import io
import wave
from pathlib import Path

import pytest

from server.transcription import speakers
from server.transcription.speakers import (
    SessionSpeakers,
    format_segment,
    has_speaker_prefixes,
    speaker_legend_hint,
    split_speaker_segment,
    strip_speaker_prefixes,
    wav_bytes_to_samples,
)

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_RATE = 16000


def _wav_bytes(seconds: float = 1.5) -> bytes:
    """A valid 16 kHz mono 16-bit PCM WAV of the requested length."""
    frames = int(seconds * SAMPLE_RATE)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(b"\x00\x01" * frames)
    return buffer.getvalue()


class FakeDiarizer:
    """Returns canned embeddings keyed by an auto-incrementing counter."""

    def __init__(self, embeddings):
        self.embeddings = list(embeddings)
        self.calls = 0

    def embed(self, _samples):
        embedding = self.embeddings[min(self.calls, len(self.embeddings) - 1)]
        self.calls += 1
        return embedding


def _unit(i: int, dim: int = 8) -> list[float]:
    """Orthogonal unit vector — different indices are maximally dissimilar."""
    vector = [0.0] * dim
    vector[i % dim] = 1.0
    return vector


@pytest.fixture
def patch_diarizer(monkeypatch):
    def install(*embeddings):
        fake = FakeDiarizer(embeddings)
        monkeypatch.setattr(speakers, "get_diarizer", lambda: fake)
        return fake

    return install


# ------------------------------------------------------------ line formatting


def test_format_and_split_roundtrip():
    assert format_segment("S1", "hello") == "S1: hello"
    assert format_segment(None, "hello") == "hello"
    assert format_segment("S?", "hello") == "S?: hello"
    assert split_speaker_segment("S1: hello") == ("S1", "hello")
    assert split_speaker_segment("S12: multi word") == ("S12", "multi word")
    assert split_speaker_segment("S?: hello") == ("S?", "hello")
    assert split_speaker_segment("plain line") == (None, "plain line")
    # Not labels: lowercase, S0, text before the colon.
    assert split_speaker_segment("s1: nope")[0] is None
    assert split_speaker_segment("S0: nope")[0] is None
    assert split_speaker_segment("Patient S1: nope")[0] is None


def test_has_prefixes_and_strip():
    text = "S1: good morning\nS?: unclear who\nplain line\nS2: thanks"
    assert has_speaker_prefixes(text) is True
    assert strip_speaker_prefixes(text) == "good morning\nunclear who\nplain line\nthanks"
    assert has_speaker_prefixes("no labels\nhere") is False
    assert strip_speaker_prefixes("no labels") == "no labels"


def test_legend_hint_only_when_prefixed():
    assert speaker_legend_hint("S1: hi") != ""
    assert "best-effort" in speaker_legend_hint("S1: hi")
    assert speaker_legend_hint("hello") == ""


# ----------------------------------------------------------------- wav parse


def test_wav_bytes_to_samples_parses_and_validates():
    parsed = wav_bytes_to_samples(_wav_bytes(0.5))
    assert parsed is not None
    samples, rate = parsed
    assert rate == SAMPLE_RATE
    assert len(samples) == 8000
    assert wav_bytes_to_samples(b"not a wav") is None
    assert wav_bytes_to_samples(b"") is None


def test_wav_bytes_rejects_wrong_rate():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(44100)
        wav.writeframes(b"\x00\x01" * 100)
    assert wav_bytes_to_samples(buffer.getvalue()) is None


# ----------------------------------------------------------- session labels


def test_first_utterance_mints_s1_then_matches(patch_diarizer):
    patch_diarizer(_unit(0), _unit(0))  # same direction both times
    registry = SessionSpeakers()
    assert registry.assign(_wav_bytes()) == "S1"
    assert registry.assign(_wav_bytes()) == "S1"
    assert registry.speaker_count == 1


def test_distinct_voice_mints_immediately(patch_diarizer):
    # Maximally dissimilar embedding (cosine 0) is unambiguously a new voice
    patch_diarizer(_unit(0), _unit(3), _unit(3))
    registry = SessionSpeakers()
    assert registry.assign(_wav_bytes()) == "S1"
    assert registry.assign(_wav_bytes()) == "S2"
    assert registry.assign(_wav_bytes()) == "S2"
    assert registry.speaker_count == 2


def test_pending_survives_intervening_match_to_other_speaker(patch_diarizer):
    # Borderline second voice (cosine ~0.45 to S1) needs confirmation.
    s1 = _unit(0)
    v2 = list(s1)
    v2[1] = 1.985  # cosine(s1, v2) = 1/sqrt(1 + 1.985^2) ≈ 0.45
    patch_diarizer(s1, v2, s1, v2)
    registry = SessionSpeakers()
    assert registry.assign(_wav_bytes()) == "S1"
    assert registry.assign(_wav_bytes()) == "S?"  # voice 2 first heard
    assert registry.assign(_wav_bytes()) == "S1"  # voice 1 again — pending kept
    assert registry.assign(_wav_bytes()) == "S2"  # voice 2 confirms
    assert registry.speaker_count == 2


def test_short_utterance_inherits_previous(patch_diarizer):
    patch_diarizer(_unit(0), _unit(3))  # second embed never used (too short)
    registry = SessionSpeakers()
    assert registry.assign(_wav_bytes(1.5)) == "S1"
    # 0.3s backchannel: inherit S1 without consulting the extractor.
    assert registry.assign(_wav_bytes(0.3)) == "S1"


def test_short_utterance_with_no_history_is_unlabeled(patch_diarizer):
    patch_diarizer(_unit(0))
    registry = SessionSpeakers()
    assert registry.assign(_wav_bytes(0.3)) is None


def test_embedder_unavailable_inherits_or_none(monkeypatch):
    class NullDiarizer:
        def embed(self, _samples):
            return None

    monkeypatch.setattr(speakers, "get_diarizer", lambda: NullDiarizer())
    registry = SessionSpeakers()
    assert registry.assign(_wav_bytes()) is None  # no history to inherit


def test_speaker_cap_falls_back_to_closest(patch_diarizer):
    # Four distinct voices mint immediately (distant zone); a fifth
    # distinct voice must fold to the closest centroid, not mint S5.
    patch_diarizer(
        _unit(0), _unit(0), _unit(1), _unit(1), _unit(2), _unit(2), _unit(3), _unit(3), _unit(4)
    )
    registry = SessionSpeakers()
    labels = [registry.assign(_wav_bytes()) for _ in range(9)]
    assert labels == ["S1", "S1", "S2", "S2", "S3", "S3", "S4", "S4", "S1"]
    assert registry.speaker_count == 4


def test_borderline_voice_mints_new_label_under_strict_default(patch_diarizer):
    # Cosine ~0.58 sits between the old (0.55) and new (0.62) thresholds:
    # under the strict default a borderline voice mints S2 instead of
    # folding into S1 — after confirmation.
    a = _unit(0)
    b = list(a)
    b[1] = 1.405  # cosine(a, b) = 1/sqrt(1 + 1.405^2) ≈ 0.58
    patch_diarizer(a, b, b)
    registry = SessionSpeakers()
    assert registry.assign(_wav_bytes()) == "S1"
    assert registry.assign(_wav_bytes()) == "S?"
    assert registry.assign(_wav_bytes()) == "S2"


def test_centroid_updates_with_ema(patch_diarizer):
    # Same speaker with mild drift: still above threshold, and the stored
    # centroid moves toward the new embedding by CENTROID_EMA_ALPHA (a
    # mis-assigned utterance decays out instead of accumulating forever).
    first = _unit(0)
    drifted = list(first)
    drifted[1] = 0.15  # ~8.5 degrees off the first embedding
    patch_diarizer(first, drifted)
    registry = SessionSpeakers(threshold=0.55)
    assert registry.assign(_wav_bytes()) == "S1"
    assert registry.assign(_wav_bytes()) == "S1"
    alpha = registry.ema_alpha
    expected = [(1 - alpha) * a + alpha * b for a, b in zip(first, drifted, strict=False)]
    assert registry._centroids["S1"] == pytest.approx(expected)


# ------------------------------------------------- real-model integration run

_model = FIXTURES.parent.parent / "assets" / "models" / speakers.MODEL_FILENAME
_wavs = {
    "speaker_a": FIXTURES / "fangjun-sr-1.wav",
    "speaker_a_again": FIXTURES / "fangjun-test-sr-1.wav",
    "speaker_b": FIXTURES / "leijun-test-sr-1.wav",
}

sherpa_ready = pytest.mark.skipif(
    not _model.is_file(), reason="speaker embedding model not downloaded"
)


@sherpa_ready
def test_real_model_separates_fixture_speakers():
    """End-to-end: same fixture voice re-matches, a new voice gets S2."""
    try:
        import sherpa_onnx  # noqa: F401
    except ImportError:
        pytest.skip("sherpa-onnx not installed")

    registry = SessionSpeakers()
    first = registry.assign(_wav_bytes())  # warm the extractor with silence
    assert first in (None, "S1")  # silence may inherit/unlabeled — fine

    registry = SessionSpeakers()
    a = registry.assign(_wavs["speaker_a"].read_bytes())
    a_again = registry.assign(_wavs["speaker_a_again"].read_bytes())
    b = registry.assign(_wavs["speaker_b"].read_bytes())
    assert a == "S1"
    assert a_again == "S1", "same fixture voice should match its centroid"
    assert b == "S2", "different fixture voice should mint a new label"
    assert registry.speaker_count == 2
