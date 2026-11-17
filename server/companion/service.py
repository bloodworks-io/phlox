import logging
import random
import threading
import time
import uuid
from datetime import datetime
from typing import Any

from server.database.repositories import companion as repository
from server.database.repositories.encounter import save_patient
from server.database.repositories.patient import (
    get_patient_profile,
    upsert_patient_profile,
)
from server.database.repositories.templates import (
    get_default_template,
    get_template_fields,
)
from server.schemas.patient import Patient
from server.transcription.text import process_transcription
from server.utils.helpers import format_name, split_name

logger = logging.getLogger(__name__)

MAX_UTTERANCES = 4_000
MAX_UTTERANCE_CHARS = 5_000
MAX_TRANSCRIPT_CHARS = 1_000_000
SPEAKER_PATTERN = r"^(S[1-9]\d*|S\?)$"

PATIENT_GUID_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "phlox:companion:patient")


class CompanionValidationError(ValueError):
    """The uploaded session document is malformed or inconsistent."""


def stable_patient_guid(ur_number: str) -> str:
    return str(uuid.uuid5(PATIENT_GUID_NAMESPACE, ur_number))


def companion_enabled() -> bool:
    """Master switch for phone sync. Ships off: opt in from User Settings."""
    from server.database.config.manager import config_manager

    raw = config_manager.get_config().get("COMPANION_ENABLED")
    if isinstance(raw, bool):
        return raw
    return raw is not None and str(raw).lower() in ("true", "1", "yes")


def companion_auto_import() -> bool:
    """Import mode: convert uploads to notes on arrival (the default), or
    hold them as 'received' for batch conversion from the Mac UI."""
    from server.database.config.manager import config_manager

    raw = config_manager.get_config().get("COMPANION_AUTO_IMPORT")
    if isinstance(raw, bool):
        return raw
    return raw is None or str(raw).lower() not in ("false", "0", "no")


def session_counts() -> dict[str, int]:
    """Tally of session rows by status, for the settings summary."""
    from server.database.core.connection import get_db

    counts = {"received": 0, "processing": 0, "failed": 0, "imported": 0}
    try:
        with get_db().read() as cursor:
            cursor.execute("SELECT status, COUNT(*) AS n FROM companion_sessions GROUP BY status")
            for row in cursor.fetchall():
                if row["status"] in counts:
                    counts[row["status"]] = row["n"]
    except Exception as e:
        logger.error(f"companion: session tally failed: {e}")
    return counts


def pairing_code() -> str | None:
    """The code the sync host is currently pairing with, published by its
    launcher into the data directory. None when the host is not running."""
    from pathlib import Path

    from server.constants import DATA_DIR

    try:
        code_file = Path(DATA_DIR) / "companion_pair_code.txt"
        if code_file.exists():
            code = code_file.read_text().strip()
            return code or None
    except Exception as e:
        logger.error(f"companion: pairing code read failed: {e}")
    return None


_host_state_lock = threading.Lock()
_pending_sync_command = False
_host_presence = {"phones": 0, "seen": 0.0, "name": None}

_HOST_ONLINE_SECONDS = 30.0


def request_sync() -> bool:
    """Latch a sync request for the host to deliver to the phone."""
    global _pending_sync_command
    with _host_state_lock:
        _pending_sync_command = True
        presence = _phone_presence_locked()
    return presence["connected"]


def host_poll(phones: int, name: str | None = None, wait_seconds: float = 20.0) -> dict[str, Any]:
    """The host's long-poll: refreshes presence, then holds until a command
    arrives (or the wait lapses). Commands are delivered exactly once."""
    global _pending_sync_command
    deadline = time.monotonic() + max(0.0, wait_seconds)
    while True:
        with _host_state_lock:
            _touch_presence(phones, name)
            if _pending_sync_command:
                _pending_sync_command = False
                return {"command": "sync"}
        if time.monotonic() >= deadline:
            return {"command": None}
        time.sleep(0.5)


def host_presence_report(phones: int, name: str | None = None) -> None:
    """Instant presence update, sent by the host the moment a phone
    connects or drops — the long-poll's frozen-at-start count would
    otherwise lag by up to its 20s hold."""
    with _host_state_lock:
        _touch_presence(phones, name)


def _touch_presence(phones: int, name: str | None) -> None:
    _host_presence.update({"phones": phones, "seen": time.monotonic(), "name": name})


def phone_presence() -> dict[str, Any]:
    """Connection state for the settings/import UI."""
    with _host_state_lock:
        return _phone_presence_locked()


def _phone_presence_locked() -> dict[str, Any]:
    online = (
        _host_presence["phones"] > 0
        and (time.monotonic() - _host_presence["seen"]) < _HOST_ONLINE_SECONDS
    )
    return {
        "connected": online,
        "host_name": _host_presence["name"],
        "phones": _host_presence["phones"],
    }


def year_of_birth(dob: str | None) -> int | None:
    if dob and len(dob) >= 4 and dob[:4].isdigit():
        return int(dob[:4])
    return None


def patient_snapshot() -> list[dict[str, Any]]:
    """Every known patient as the phone needs it, merged from profiles."""
    from server.database.core.connection import get_db

    patients: list[dict[str, Any]] = []
    with get_db().read() as cursor:
        cursor.execute(
            "SELECT ur_number, first_name, last_name, dob FROM patient_profiles"
            " WHERE ur_number IS NOT NULL AND ur_number != '' ORDER BY last_name, first_name"
        )
        for row in cursor.fetchall():
            ur_number = row["ur_number"]
            patients.append(
                {
                    "guid": stable_patient_guid(ur_number),
                    "ur_number": ur_number,
                    "display_name": format_name(row["first_name"], row["last_name"]),
                    "year_of_birth": year_of_birth(row["dob"]),
                }
            )
    return patients


def generate_placeholder_ur_number() -> str:
    """Visibly synthetic CP###### for phone patients with no clinician-entered
    UR number — collision-checked so it can never shadow a real one."""
    from server.database.repositories import companion as repo

    for _ in range(100):
        candidate = f"CP{random.randint(0, 999_999):06d}"
        if not repo.ur_number_exists(candidate):
            return candidate
    raise RuntimeError("could not allocate a companion placeholder ur_number")


def register_phone_patients(patients: list[dict[str, Any]]) -> dict[str, Any]:
    """Create phone-minted patients as profile rows; merge by GUID only."""
    accepted: list[str] = []
    duplicates: list[str] = []
    for record in patients:
        guid = str(record.get("guid") or "")
        display_name = (record.get("display_name") or "").strip()
        if not guid or not display_name:
            continue
        if repository.get_mapped_ur_number(guid) is not None:
            duplicates.append(guid)
            continue

        ur_number = (record.get("ur_number") or "").strip() or generate_placeholder_ur_number()
        first, last = split_name(display_name)
        upsert_patient_profile(ur_number, first, last, None, None, None, None)
        repository.map_patient(guid, ur_number)
        accepted.append(guid)
        logger.info(f"companion: registered phone patient {guid} as {ur_number}")
    return {"accepted": accepted, "duplicates": duplicates}


def validate_document(document: dict[str, Any]) -> None:
    manifest = document.get("manifest") or {}
    utterances = document.get("utterances") or []
    if not isinstance(utterances, list):
        raise CompanionValidationError("utterances must be a list")
    if len(utterances) > MAX_UTTERANCES:
        raise CompanionValidationError(f"session exceeds {MAX_UTTERANCES} utterances")
    if not manifest.get("ended_at") or manifest.get("utterance_count") is None:
        raise CompanionValidationError("session manifest is not sealed")
    if manifest.get("utterance_count") != len(utterances):
        raise CompanionValidationError("utterance_count does not match utterances")
    if manifest.get("mode", "ambient") != "ambient":
        raise CompanionValidationError(f"unsupported capture mode {manifest.get('mode')!r}")
    if not (
        manifest.get("patient_guid")
        or manifest.get("patient_ur_number")
        or (manifest.get("patient_display_name") or "").strip()
    ):
        raise CompanionValidationError("session has no patient")

    import re

    total_chars = 0
    for index, utterance in enumerate(utterances):
        if utterance.get("sequence") != index:
            raise CompanionValidationError(
                f"sequence gap: utterance {index} has sequence {utterance.get('sequence')}"
            )
        speaker = utterance.get("speaker")
        if speaker is not None and not re.match(SPEAKER_PATTERN, speaker):
            raise CompanionValidationError(f"invalid speaker label {speaker!r}")
        text = utterance.get("text") or ""
        if not str(text).strip():
            raise CompanionValidationError(f"utterance {index} is empty")
        total_chars += len(text)
        if len(text) > MAX_UTTERANCE_CHARS:
            raise CompanionValidationError(f"utterance {index} exceeds {MAX_UTTERANCE_CHARS} chars")
    if total_chars > MAX_TRANSCRIPT_CHARS:
        raise CompanionValidationError("transcript exceeds the size bound")
    if not utterances:
        raise CompanionValidationError("session has no utterances")


def _render_transcript(utterances: list[dict[str, Any]]) -> str:
    lines = []
    for utterance in utterances:
        text = " ".join(str(utterance.get("text") or "").split())
        speaker = utterance.get("speaker")
        lines.append(f"{speaker}: {text}" if speaker else text)
    return "\n".join(lines)


def _resolve_patient(manifest: dict[str, Any]) -> dict[str, Any]:
    """Best-effort demographics for the encounter, resolved by GUID mapping
    (phone-pushed patients), the stable pull GUID (patients that already
    existed on the Mac — their GUID is derivable from the UR number), then
    by the phone's UR hint and display name."""
    demographics: dict[str, Any] = {}
    patient_guid = manifest.get("patient_guid")
    ur_number = repository.get_mapped_ur_number(str(patient_guid)) if patient_guid else None
    if not ur_number and patient_guid:
        ur_number = _ur_number_for_pull_guid(str(patient_guid))
    if not ur_number:
        ur_number = (manifest.get("patient_ur_number") or "").strip() or None
    if ur_number:
        demographics = get_patient_profile(ur_number) or {}
        demographics.setdefault("ur_number", ur_number)
    if not demographics.get("first_name") and not demographics.get("last_name"):
        first, last = split_name(manifest.get("patient_display_name") or "")
        if first or last:
            demographics["first_name"] = first
            demographics["last_name"] = last

    if not demographics.get("ur_number"):
        ur_number = generate_placeholder_ur_number()
        if patient_guid:
            repository.map_patient(str(patient_guid), ur_number)
        demographics["ur_number"] = ur_number
    return demographics


def _resolve_template_key(requested: str | None) -> str:
    if requested:
        return requested
    default = get_default_template()
    return (default or {}).get("template_key") or "phlox_01"


def _ur_number_for_pull_guid(guid: str) -> str | None:
    """Reverse the stable pull GUID: patients pulled from the Mac carry
    uuid5(PATIENT_GUID_NAMESPACE, ur_number), so a known profile's GUID can
    be matched without a companion_patients row."""
    from server.database.core.connection import get_db

    try:
        with get_db().read() as cursor:
            cursor.execute(
                "SELECT ur_number FROM patient_profiles"
                " WHERE ur_number IS NOT NULL AND ur_number != ''"
            )
            for row in cursor.fetchall():
                if stable_patient_guid(row["ur_number"]) == guid:
                    return row["ur_number"]
    except Exception as e:
        logger.error(f"companion: pull-guid reverse lookup failed: {e}")
    return None


def claim_metadata(document: dict[str, Any]) -> dict[str, Any]:
    """The manifest fields recorded when a session is claimed, plus the raw
    document (kept for Mac-side retries until the import succeeds)."""
    manifest = document.get("manifest") or {}
    return {
        "device_id": manifest.get("device_id"),
        "patient_display_name": manifest.get("patient_display_name"),
        "patient_ur_number": manifest.get("patient_ur_number"),
        "started_at": str(manifest.get("started_at") or "") or None,
        "ended_at": str(manifest.get("ended_at") or "") or None,
        "utterance_count": manifest.get("utterance_count"),
        "document": document,
    }


async def run_import(
    session_guid: str,
    document: dict[str, Any],
    template_key: str | None,
    light: bool = False,
) -> None:
    """Background import."""
    import time

    try:
        manifest = document["manifest"]
        utterances = document["utterances"]
        transcript = _render_transcript(utterances)

        key = _resolve_template_key(template_key)

        demographics = _resolve_patient(manifest)
        patient_context = {
            "name": format_name(demographics.get("first_name"), demographics.get("last_name")),
            "dob": demographics.get("dob"),
            "gender": demographics.get("gender"),
        }

        started = datetime.fromisoformat(manifest["started_at"].replace("Z", "+00:00"))
        ended = datetime.fromisoformat(manifest["ended_at"].replace("Z", "+00:00"))

        if light:
            generated: dict[str, Any] = {}
            note_citations = None
            process_duration = None
        else:
            fields = get_template_fields(key)
            result = await process_transcription(
                transcript,
                fields,
                patient_context,
                is_ambient=True,
            )
            generated = result.get("fields") or {}
            note_citations = {
                "transcript_line_count": len(transcript.split("\n")),
                "resolved": [],
                "fields": result.get("citations") or {},
            }
            process_duration = result.get("process_duration")

        patient = Patient(
            name=patient_context["name"] or "Unknown (phone import)",
            first_name=demographics.get("first_name"),
            last_name=demographics.get("last_name"),
            dob=demographics.get("dob"),
            ur_number=demographics.get("ur_number"),
            gender=demographics.get("gender"),
            # The clinician's local day, not the UTC one — a morning
            # consultation must not land on yesterday's list.
            encounter_date=started.astimezone().date().isoformat(),
            template_key=key,
            template_data=generated,
            raw_transcription=transcript,
            transcription_duration=max(0.0, (ended - started).total_seconds()),
            process_duration=process_duration,
            note_citations=note_citations,
        )
        encounter_id = save_patient(patient)
        repository.finish_import(session_guid, encounter_id)
        logger.info(
            f"companion: {'filed' if light else 'imported'} session {session_guid}"
            f" as encounter {encounter_id}"
        )
    except Exception as e:  # noqa: BLE001 - recorded for the phone/host
        logger.error(f"companion: import of {session_guid} failed: {e}")
        repository.fail_import(session_guid, str(e))


async def run_imports(
    session_guids: list[str],
    template_key: str | None = None,
    generate: bool = False,
) -> None:
    """Batch filing."""
    for session_guid in session_guids:
        document = repository.get_document(session_guid)
        if document is None:
            repository.fail_import(session_guid, "no stored document to import")
            continue
        await run_import(session_guid, document, template_key, light=not generate)
