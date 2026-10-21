import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from server.companion import service
from server.database.repositories import companion as repository

logger = logging.getLogger(__name__)

router = APIRouter(tags=["companion"])


def _require_enabled() -> None:
    """Gate the phone-facing routes on the master switch."""
    if not service.companion_enabled():
        raise HTTPException(status_code=503, detail="Companion sync is disabled")


class PhonePatientIn(BaseModel):
    guid: UUID
    display_name: str
    year_of_birth: int | None = None
    ur_number: str | None = None


class PatientsPushRequest(BaseModel):
    patients: list[PhonePatientIn]


class UtteranceIn(BaseModel):
    sequence: int
    start_ms: int = Field(ge=0)
    end_ms: int = Field(ge=0)
    speaker: str | None = None
    text: str


class ManifestIn(BaseModel):
    session_id: UUID
    device_id: str
    patient_guid: UUID | None = None
    patient_display_name: str | None = None
    patient_ur_number: str | None = None
    mode: str = "ambient"
    started_at: datetime
    ended_at: datetime | None = None
    model_identity: dict[str, str] = Field(default_factory=dict)
    utterance_count: int | None = None


class SessionDocumentIn(BaseModel):
    manifest: ManifestIn
    utterances: list[UtteranceIn]


class ImportRequest(BaseModel):
    document: SessionDocumentIn
    template_key: str | None = None


class HostPresenceRequest(BaseModel):
    phones: int
    name: str | None = None


class BatchImportRequest(BaseModel):
    session_ids: list[UUID]
    template_key: str | None = None
    generate: bool = False


@router.get("/patients")
def patients_snapshot() -> dict[str, Any]:
    _require_enabled()
    return {"patients": service.patient_snapshot()}


@router.post("/patients")
def push_patients(body: PatientsPushRequest) -> dict[str, Any]:
    _require_enabled()
    result = service.register_phone_patients([patient.model_dump() for patient in body.patients])
    return {
        "accepted": [str(guid) for guid in result["accepted"]],
        "duplicates": [str(guid) for guid in result["duplicates"]],
    }


@router.post("/sessions/import")
async def import_session(body: ImportRequest, background: BackgroundTasks) -> dict[str, Any]:
    _require_enabled()
    document = body.document.model_dump(mode="json")
    session_guid = str(document["manifest"]["session_id"])

    try:
        service.validate_document(document)
    except service.CompanionValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    existing = repository.get_import(session_guid)
    if existing and existing["status"] == "imported":
        return {
            "session_id": session_guid,
            "accepted": False,
            "already_imported": True,
            "status": "imported",
            "encounter_id": existing["encounter_id"],
        }

    metadata = service.claim_metadata(document)
    if not service.companion_auto_import():
        held = repository.start_import(session_guid, metadata, status="received")
        return {
            "session_id": session_guid,
            "accepted": True,
            "already_imported": False,
            "status": "received" if held else repository.get_import(session_guid)["status"],
        }

    claimed = repository.start_import(session_guid, metadata) or repository.reset_failed_import(
        session_guid
    )
    if not claimed:
        # Auto mode over a previously-held row: promote it and import now.
        claimed = repository.claim_received(session_guid)
    if not claimed:
        logger.info(f"companion: session {session_guid} already processing")
        return {
            "session_id": session_guid,
            "accepted": True,
            "already_imported": False,
            "status": "processing",
        }

    # Auto mode files cheaply (no LLM); generation happens later, per note.
    background.add_task(service.run_import, session_guid, document, body.template_key, light=True)
    return {
        "session_id": session_guid,
        "accepted": True,
        "already_imported": False,
        "status": "claimed",
    }


@router.get("/status")
def companion_status() -> dict[str, Any]:
    return {
        "enabled": service.companion_enabled(),
        "counts": service.session_counts(),
        "pairing_code": service.pairing_code(),
        "phone": service.phone_presence(),
    }


@router.post("/sync/trigger")
def trigger_sync() -> dict[str, Any]:
    """The desktop UI's click on the phone icon: ask the paired phone (via
    the sync host) to run its sync sequence now."""
    connected = service.request_sync()
    return {"status": "requested", "phone_connected": connected}


@router.post("/host/presence")
def host_presence(body: HostPresenceRequest) -> dict[str, Any]:
    """Immediate connection-count update from the sync host."""
    service.host_presence_report(phones=body.phones, name=body.name)
    return {"status": "ok"}


@router.get("/host/poll")
def host_poll(phones: int = 0, name: str | None = None, wait: float = 20.0) -> dict[str, Any]:
    """The sync host's command channel. Long-held; refreshes phone presence
    on every call."""
    return service.host_poll(phones=phones, name=name, wait_seconds=wait)


@router.get("/sessions")
def sessions_list() -> dict[str, Any]:
    sessions = []
    for row in repository.list_sessions():
        sessions.append(
            {
                "session_id": row["session_guid"],
                "status": row["status"],
                "error": row["error"],
                "encounter_id": row["encounter_id"],
                "encounter_date": row["encounter_date"],
                "received_at": row["received_at"],
                "device_id": row["device_id"],
                "patient_display_name": row["patient_display_name"],
                "patient_ur_number": row["patient_ur_number"],
                "started_at": row["started_at"],
                "ended_at": row["ended_at"],
                "utterance_count": row["utterance_count"],
            }
        )
    return {"sessions": sessions}


@router.get("/sessions/{session_guid}")
def session_status(session_guid: UUID) -> dict[str, Any]:
    _require_enabled()
    row = repository.get_import(str(session_guid))
    if not row:
        raise HTTPException(status_code=404, detail="unknown session")
    return {
        "session_id": session_guid,
        "status": row["status"],
        "encounter_id": row["encounter_id"],
        "error": row["error"],
    }


@router.get("/sessions/{session_guid}/document")
def session_document(session_guid: UUID) -> dict[str, Any]:
    document = repository.get_document(str(session_guid))
    if document is None:
        raise HTTPException(status_code=404, detail="no stored document")
    return document


@router.post("/sessions/import-batch")
async def import_sessions_batch(
    body: BatchImportRequest, background: BackgroundTasks
) -> dict[str, Any]:
    """Batch-convert held (or retry failed) sessions into notes, one at a
    time. Ids that are already imported or mid-import are reported, never
    re-run."""
    results: list[dict[str, Any]] = []
    claimed: list[str] = []
    for session_guid in body.session_ids:
        guid = str(session_guid)
        row = repository.get_import(guid)
        if not row:
            results.append({"session_id": session_guid, "status": "unknown"})
        elif row["status"] == "imported":
            results.append(
                {
                    "session_id": session_guid,
                    "status": "imported",
                    "encounter_id": row["encounter_id"],
                }
            )
        elif row["status"] == "processing":
            results.append({"session_id": session_guid, "status": "processing"})
        elif repository.claim_received(guid) or repository.reset_failed_import(guid):
            claimed.append(guid)
            results.append({"session_id": session_guid, "status": "claimed"})
        else:
            results.append({"session_id": session_guid, "status": row["status"]})

    if claimed:
        background.add_task(service.run_imports, claimed, body.template_key, body.generate)
    return {"results": results}


@router.post("/sessions/{session_guid}/retry")
async def retry_session(session_guid: UUID, background: BackgroundTasks) -> dict[str, Any]:
    row = repository.get_import(str(session_guid))
    if not row:
        raise HTTPException(status_code=404, detail="unknown session")
    if row["status"] == "imported":
        return {
            "session_id": session_guid,
            "status": "imported",
            "encounter_id": row["encounter_id"],
        }
    document = repository.get_document(str(session_guid))
    if row["status"] == "processing":
        return {"session_id": session_guid, "status": "processing"}
    if document is None:
        raise HTTPException(status_code=409, detail="session has no stored document to retry")

    if not (
        repository.reset_failed_import(str(session_guid))
        or repository.claim_received(str(session_guid))
    ):
        return {"session_id": session_guid, "status": "processing"}
    background.add_task(service.run_import, str(session_guid), document, None, light=True)
    return {"session_id": session_guid, "status": "claimed"}


@router.delete("/sessions/{session_guid}")
def dismiss_session(session_guid: UUID) -> dict[str, Any]:
    if not repository.delete_session(str(session_guid)):
        row = repository.get_import(str(session_guid))
        if row and row["status"] == "processing":
            raise HTTPException(status_code=409, detail="session is processing")
        raise HTTPException(status_code=404, detail="unknown session")
    return {"session_id": session_guid, "dismissed": True}
