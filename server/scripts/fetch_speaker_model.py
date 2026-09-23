#!/usr/bin/env python3
"""Fetch the CAM++ speaker embedding model for live diarization."""

import hashlib
import sys
import urllib.request
from pathlib import Path

MODEL_URL = (
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/"
    "speaker-recongition-models/3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx"
)
MODEL_SHA256 = "aa3cfc16963a10586a9393f5035d6d6b57e98d358b347f80c2a30bf4f00ceba2"
MODEL_FILENAME = "campplus-zh-en.onnx"

# server/scripts/fetch_speaker_model.py -> server/assets/models/<file>
TARGET = Path(__file__).resolve().parents[1] / "assets" / "models" / MODEL_FILENAME


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    if TARGET.is_file() and sha256_of(TARGET) == MODEL_SHA256:
        print(f"speaker model present: {TARGET} ({TARGET.stat().st_size} bytes)")
        return 0

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    partial = TARGET.with_suffix(TARGET.suffix + ".part")
    print(f"fetching speaker model from {MODEL_URL}")
    try:
        with urllib.request.urlopen(MODEL_URL) as response, partial.open("wb") as handle:
            while True:
                chunk = response.read(1 << 20)
                if not chunk:
                    break
                handle.write(chunk)
    except Exception as exc:  # noqa: BLE001 - report any network failure cleanly
        partial.unlink(missing_ok=True)
        print(f"error: speaker model download failed: {exc}", file=sys.stderr)
        return 1

    digest = sha256_of(partial)
    if digest != MODEL_SHA256:
        partial.unlink(missing_ok=True)
        print(f"error: speaker model checksum mismatch: {digest}", file=sys.stderr)
        return 1

    partial.replace(TARGET)
    print(f"speaker model ready: {TARGET} ({TARGET.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
