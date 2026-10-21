"""Tests for the companion sync façade (patient snapshot/push and session
import). process_transcription is stubbed — LLM behaviour is covered by the
transcription tests; these assert the companion plumbing."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.companion import router as companion_router, service
from server.database.repositories import companion as repository
from server.database.core.connection import get_db
from server.database.repositories.encounter import get_patient_by_id
from server.database.repositories.patient import upsert_patient_profile

app = FastAPI()
app.include_router(companion_router.router, prefix="/api/companion")
client = TestClient(app)


@pytest.fixture(autouse=True)
def clinician():
    from server.utils.current_user import CurrentUser, set_current_user

    set_current_user(CurrentUser(910001, "test_clinician", "clinician"))
    yield
    set_current_user(None)


@pytest.fixture(autouse=True)
def clean_companion_state():
    """The test database persists across runs; keep these tests deterministic.
    Companion ships off by default — turn it on for these tests, which
    exercise the enabled behaviour (the default is asserted separately)."""
    from server.database.core.connection import get_db
    from server.database.config.manager import config_manager

    config_manager.update_config({"COMPANION_ENABLED": True})
    service._host_presence.update({"phones": 0, "seen": 0.0, "name": None})
    with get_db().transaction() as cursor:
        cursor.execute("DELETE FROM companion_sessions")
        cursor.execute("DELETE FROM companion_patients")
        cursor.execute(
            "DELETE FROM encounters WHERE ur_number LIKE 'UR-SNAP%' OR ur_number LIKE 'UR-ADA%'"
            " OR ur_number LIKE 'CP%' OR ur_number = ''"
        )
        cursor.execute(
            "DELETE FROM patient_profiles WHERE ur_number LIKE 'UR-SNAP%'"
            " OR ur_number LIKE 'UR-ADA%' OR ur_number LIKE 'CP%'"
        )
    yield
    config_manager.update_config({"COMPANION_ENABLED": False})


@pytest.fixture(autouse=True)
def stub_processing(monkeypatch):
    """Deterministic note generation without an LLM."""
    async def fake_process(transcript, fields, patient_context, is_ambient=True, primary_condition=None):
        return {
            "fields": {field.field_key: f"noted: {field.field_key}" for field in fields},
            "citations": {field.field_key: [] for field in fields},
            "process_duration": 0.5,
        }

    monkeypatch.setattr(service, "process_transcription", fake_process)


def _document(session_id="11111111-1111-1111-1111-111111111111", **manifest_overrides):
    started = datetime.now(timezone.utc) - timedelta(minutes=10)
    utterances = [
        {"sequence": 0, "start_ms": 0, "end_ms": 4_000, "speaker": "S1", "text": "The knee has hurt for a week."},
        {"sequence": 1, "start_ms": 5_000, "end_ms": 9_000, "speaker": "S2", "text": "Any swelling?"},
        {"sequence": 2, "start_ms": 9_500, "end_ms": 12_000, "speaker": None, "text": "A little, in the morning."},
    ]
    manifest = {
        "session_id": session_id,
        "device_id": "test-device",
        "patient_display_name": "Doe, Jane",
        "mode": "ambient",
        "started_at": started.isoformat(),
        "ended_at": (started + timedelta(minutes=10)).isoformat(),
        "model_identity": {"parakeet_revision": "abc"},
        "utterance_count": len(utterances),
    }
    manifest.update(manifest_overrides)
    return {"manifest": manifest, "utterances": utterances}


def test_snapshot_lists_profiles_with_stable_guids():
    upsert_patient_profile("UR-SNAP", "Jane", "Doe", "1961-04-01", None, None, None)
    first = client.get("/api/companion/patients").json()["patients"]
    second = client.get("/api/companion/patients").json()["patients"]
    entry = next(p for p in first if p["ur_number"] == "UR-SNAP")
    assert entry["display_name"] == "Doe, Jane"
    assert entry["year_of_birth"] == 1961
    assert entry["guid"] == next(p for p in second if p["ur_number"] == "UR-SNAP")["guid"]


def test_push_uses_clinician_ur_and_generates_placeholders():
    with_ur = {"guid": "22222222-2222-2222-2222-222222222221", "display_name": "Ada Lovelace", "ur_number": "UR-ADA"}
    without_ur = {"guid": "22222222-2222-2222-2222-222222222222", "display_name": "Grace Hopper"}
    result = client.post("/api/companion/patients", json={"patients": [with_ur, without_ur]}).json()
    assert sorted(result["accepted"]) == sorted([with_ur["guid"], without_ur["guid"]])

    # Clinician-entered UR used verbatim; blank got a synthetic CP######.
    assert repository.get_mapped_ur_number(with_ur["guid"]) == "UR-ADA"
    placeholder = repository.get_mapped_ur_number(without_ur["guid"])
    assert placeholder.startswith("CP") and len(placeholder) == 8

    # Re-push merges by GUID, never creating a second patient.
    again = client.post("/api/companion/patients", json={"patients": [with_ur]}).json()
    assert again["duplicates"] == [with_ur["guid"]] and again["accepted"] == []


def test_auto_import_files_encounter_without_llm(monkeypatch):
    calls = []

    async def watched(transcript, fields, patient_context, is_ambient=True, primary_condition=None):
        calls.append(transcript)
        return {"fields": {}, "citations": {}, "process_duration": 0.1}

    monkeypatch.setattr(service, "process_transcription", watched)

    document = _document()
    response = client.post("/api/companion/sessions/import", json={"document": document})
    assert response.status_code == 200
    assert response.json()["accepted"] is True

    status = client.get(f"/api/companion/sessions/{document['manifest']['session_id']}").json()
    assert status["status"] == "imported", status
    encounter_id = status["encounter_id"]

    note = get_patient_by_id(encounter_id)
    assert note["raw_transcription"] == (
        "S1: The knee has hurt for a week.\nS2: Any swelling?\nA little, in the morning."
    )
    assert note["first_name"] == "Jane"
    assert note["last_name"] == "Doe"
    assert note["transcription_duration"] == 600.0
    template_data = note["template_data"]
    if isinstance(template_data, str):
        import json as _json
        template_data = _json.loads(template_data)
    assert template_data == {}, "auto import files light — fields generate later"
    assert note["note_citations"] is None
    assert calls == [], "no LLM pass during a light import"


def test_batch_generate_runs_the_llm_with_the_chosen_template():
    from server.database.config.manager import config_manager

    held = _document(session_id="99999999-9999-9999-9999-999999999991")
    try:
        config_manager.update_config({"COMPANION_AUTO_IMPORT": False})
        client.post("/api/companion/sessions/import", json={"document": held})
    finally:
        config_manager.update_config({"COMPANION_AUTO_IMPORT": True})

    response = client.post(
        "/api/companion/sessions/import-batch",
        json={"session_ids": [held["manifest"]["session_id"]], "generate": True},
    )
    assert response.status_code == 200
    assert response.json()["results"][0]["status"] == "claimed"

    status = client.get(f"/api/companion/sessions/{held['manifest']['session_id']}").json()
    note = get_patient_by_id(status["encounter_id"])
    template_data = note["template_data"]
    if isinstance(template_data, str):
        import json as _json
        template_data = _json.loads(template_data)
    assert template_data and all(
        value.startswith("noted:") for value in template_data.values()
    ), "generate=true runs the full note pipeline"
    citations = note["note_citations"]
    assert citations["transcript_line_count"] == 3 and "fields" in citations


def test_reimport_is_idempotent():
    document = _document(session_id="33333333-3333-3333-3333-333333333331")
    first = client.post("/api/companion/sessions/import", json={"document": document}).json()
    assert first["accepted"] is True

    def encounter_count() -> int:
        with get_db().read() as cursor:
            cursor.execute("SELECT COUNT(*) AS n FROM encounters")
            return cursor.fetchone()["n"]

    before = encounter_count()
    second = client.post("/api/companion/sessions/import", json={"document": document}).json()
    assert second == {
        "session_id": document["manifest"]["session_id"],
        "accepted": False,
        "already_imported": True,
        "status": "imported",
        "encounter_id": second["encounter_id"],
    }
    assert encounter_count() == before, "re-import must not create a second encounter"


def test_reimport_after_failure_retries():
    document = _document(session_id="33333333-3333-3333-3333-333333333332")
    client.post("/api/companion/sessions/import", json={"document": document})
    repository.fail_import(document["manifest"]["session_id"], "injected failure")

    retry = client.post("/api/companion/sessions/import", json={"document": document}).json()
    assert retry["accepted"] is True
    status = client.get(f"/api/companion/sessions/{document['manifest']['session_id']}").json()
    assert status["status"] == "imported" and status["encounter_id"] is not None


def test_validation_rejects_broken_documents():
    unsealed = _document(ended_at=None, utterance_count=None)
    assert client.post("/api/companion/sessions/import", json={"document": unsealed}).status_code == 422

    gap = _document()
    gap["utterances"][1]["sequence"] = 5
    assert client.post("/api/companion/sessions/import", json={"document": gap}).status_code == 422

    bad_speaker = _document()
    bad_speaker["utterances"][0]["speaker"] = "Speaker One"
    assert client.post("/api/companion/sessions/import", json={"document": bad_speaker}).status_code == 422

    orphan = _document(session_id="77777777-7777-7777-7777-777777777771",
                       patient_guid=None, patient_display_name=None, patient_ur_number=None)
    assert client.post("/api/companion/sessions/import", json={"document": orphan}).status_code == 422


def test_sessions_list_shows_metadata_and_clears_document():
    document = _document(session_id="44444444-4444-4444-4444-444444444441")
    client.post("/api/companion/sessions/import", json={"document": document})

    sessions = client.get("/api/companion/sessions").json()["sessions"]
    row = next(s for s in sessions if s["session_id"] == document["manifest"]["session_id"])
    assert row["status"] == "imported"
    assert row["device_id"] == "test-device"
    assert row["patient_display_name"] == "Doe, Jane"
    assert row["utterance_count"] == 3
    assert row["encounter_id"] is not None
    assert row["encounter_date"] is not None
    assert row["started_at"] and row["ended_at"]

    # The raw document is dropped once the import succeeds.
    doc = client.get(f"/api/companion/sessions/{row['session_id']}/document")
    assert doc.status_code == 404


def test_failed_session_retries_from_stored_document(monkeypatch):
    from server.database.config.manager import config_manager

    document = _document(session_id="44444444-4444-4444-4444-444444444442")
    try:
        config_manager.update_config({"COMPANION_AUTO_IMPORT": False})
        client.post("/api/companion/sessions/import", json={"document": document})
    finally:
        config_manager.update_config({"COMPANION_AUTO_IMPORT": True})

    async def explode(transcript, fields, patient_context, is_ambient=True, primary_condition=None):
        raise RuntimeError("llama ate the note")

    monkeypatch.setattr(service, "process_transcription", explode)
    batch = client.post(
        "/api/companion/sessions/import-batch",
        json={"session_ids": [document["manifest"]["session_id"]], "generate": True},
    )
    assert batch.json()["results"][0]["status"] == "claimed"

    status = client.get(f"/api/companion/sessions/{document['manifest']['session_id']}").json()
    assert status["status"] == "failed" and "llama" in status["error"]

    # The stored document survives the failure and feeds the Mac-side retry
    # (which files light — the LLM can be asked for later).
    stored = client.get(f"/api/companion/sessions/{document['manifest']['session_id']}/document").json()
    assert stored["manifest"]["device_id"] == "test-device"

    retry = client.post(f"/api/companion/sessions/{document['manifest']['session_id']}/retry")
    assert retry.status_code == 200 and retry.json()["status"] == "claimed"

    final = client.get(f"/api/companion/sessions/{document['manifest']['session_id']}").json()
    assert final["status"] == "imported" and final["encounter_id"] is not None


def test_dismiss_removes_rows_but_refuses_processing():
    document = _document(session_id="44444444-4444-4444-4444-444444444443")
    client.post("/api/companion/sessions/import", json={"document": document})
    guid = document["manifest"]["session_id"]
    assert client.delete(f"/api/companion/sessions/{guid}").json()["dismissed"] is True
    assert client.get(f"/api/companion/sessions/{guid}").status_code == 404

    # A row mid-import cannot be dismissed out from under the background task.
    repository.start_import("44444444-4444-4444-4444-444444444444")
    assert client.delete("/api/companion/sessions/44444444-4444-4444-4444-444444444444").status_code == 409


def test_disable_switch_gates_phone_routes_not_admin():
    from server.database.config.manager import config_manager

    with get_db().transaction() as cursor:
        cursor.execute("DELETE FROM config WHERE key = 'COMPANION_ENABLED'")
    config_manager._load_configs()

    # Ships off: with the key absent the phone routes stay closed.
    assert client.get("/api/companion/patients").status_code == 503

    try:
        config_manager.update_config({"COMPANION_ENABLED": False})

        assert client.get("/api/companion/patients").status_code == 503
        assert client.post(
            "/api/companion/sessions/import", json={"document": _document()}
        ).status_code == 503

        status = client.get("/api/companion/status").json()
        assert status["enabled"] is False and "received" in status["counts"]
        assert client.get("/api/companion/sessions").status_code == 200
    finally:
        config_manager.update_config({"COMPANION_ENABLED": True})

    assert client.get("/api/companion/patients").status_code == 200


def test_hold_mode_stores_received_without_importing():
    from server.database.config.manager import config_manager

    document = _document(session_id="55555555-5555-5555-5555-555555555551")

    def encounter_count() -> int:
        with get_db().read() as cursor:
            cursor.execute("SELECT COUNT(*) AS n FROM encounters")
            return cursor.fetchone()["n"]

    try:
        config_manager.update_config({"COMPANION_AUTO_IMPORT": False})
        before = encounter_count()

        upload = client.post("/api/companion/sessions/import", json={"document": document}).json()
        assert upload["status"] == "received"

        status = client.get(f"/api/companion/sessions/{document['manifest']['session_id']}").json()
        assert status["status"] == "received" and status["encounter_id"] is None
        assert encounter_count() == before, "hold mode must not generate notes"

        # The document waits in the row, and dismissal can clear a held session.
        stored = client.get(f"/api/companion/sessions/{document['manifest']['session_id']}/document").json()
        assert stored["manifest"]["device_id"] == "test-device"
        counts = client.get("/api/companion/status").json()["counts"]
        assert counts["received"] >= 1
    finally:
        config_manager.update_config({"COMPANION_AUTO_IMPORT": True})

    # Flipping back to auto imports a re-uploaded held session.
    again = client.post("/api/companion/sessions/import", json={"document": document}).json()
    assert again["status"] == "claimed"
    final = client.get(f"/api/companion/sessions/{document['manifest']['session_id']}").json()
    assert final["status"] == "imported" and final["encounter_id"] is not None


def test_batch_import_converts_held_and_failed_sessions():
    from server.database.config.manager import config_manager

    held = _document(session_id="55555555-5555-5555-5555-555555555552")
    to_fail = _document(session_id="55555555-5555-5555-5555-555555555553")
    from server.database.config.manager import config_manager

    try:
        config_manager.update_config({"COMPANION_AUTO_IMPORT": False})
        client.post("/api/companion/sessions/import", json={"document": held})
        client.post("/api/companion/sessions/import", json={"document": to_fail})
        repository.fail_import(to_fail["manifest"]["session_id"], "injected failure")
    finally:
        config_manager.update_config({"COMPANION_AUTO_IMPORT": True})

    response = client.post(
        "/api/companion/sessions/import-batch",
        json={
            "session_ids": [
                held["manifest"]["session_id"],
                to_fail["manifest"]["session_id"],
                "66666666-6666-6666-6666-666666666666",
            ]
        },
    )
    assert response.status_code == 200
    statuses = {r["session_id"]: r["status"] for r in response.json()["results"]}
    assert statuses[held["manifest"]["session_id"]] == "claimed"
    assert statuses[to_fail["manifest"]["session_id"]] == "claimed"
    assert statuses["66666666-6666-6666-6666-666666666666"] == "unknown"

    for document in (held, to_fail):
        status = client.get(f"/api/companion/sessions/{document['manifest']['session_id']}").json()
        assert status["status"] == "imported" and status["encounter_id"] is not None


def test_sync_command_channel_and_presence():
    # No host online: nothing connected.
    assert client.get("/api/companion/status").json()["phone"]["connected"] is False

    # The host polls with one phone attached: presence goes live.
    poll = client.get("/api/companion/host/poll",
                      params={"phones": 1, "name": "Filipe's Mac", "wait": 0}).json()
    assert poll == {"command": None}
    phone = client.get("/api/companion/status").json()["phone"]
    assert phone["connected"] is True and phone["host_name"] == "Filipe's Mac"

    # A trigger latches the command; the next poll delivers it exactly once.
    trigger = client.post("/api/companion/sync/trigger").json()
    assert trigger["status"] == "requested" and trigger["phone_connected"] is True
    first = client.get("/api/companion/host/poll", params={"phones": 1, "wait": 0}).json()
    assert first == {"command": "sync"}
    second = client.get("/api/companion/host/poll", params={"phones": 1, "wait": 0}).json()
    assert second == {"command": None}


def test_pull_guid_resolves_to_existing_patient_not_a_placeholder():
    from server.database.repositories.patient import upsert_patient_profile

    upsert_patient_profile("UR-PULL", "James", "Anderson", None, None, None, None)
    document = _document(
        session_id="88888888-8888-8888-8888-888888888881",
        patient_guid=service.stable_patient_guid("UR-PULL"),
        patient_display_name=None,
        patient_ur_number=None,
    )
    client.post("/api/companion/sessions/import", json={"document": document})

    status = client.get(f"/api/companion/sessions/{document['manifest']['session_id']}").json()
    note = get_patient_by_id(status["encounter_id"])
    assert note["ur_number"] == "UR-PULL"
    assert note["first_name"] == "James" and note["last_name"] == "Anderson"
    with get_db().read() as cursor:
        placeholders = cursor.execute(
            "SELECT COUNT(*) AS n FROM patient_profiles WHERE ur_number LIKE 'CP%'"
        ).fetchone()["n"]
    assert placeholders == 0, "an existing patient must never get a CP duplicate"


def test_encounter_date_uses_the_local_day():
    from datetime import datetime as dt

    # Local 00:30 — east of UTC this is still the previous UTC day, the
    # exact trap the importer must avoid.
    local_half_past_midnight = (
        dt.now().astimezone().replace(hour=0, minute=30, second=0, microsecond=0)
    )
    document = _document(
        session_id="88888888-8888-8888-8888-888888888882",
        started_at=local_half_past_midnight.isoformat(),
        ended_at=(local_half_past_midnight + timedelta(minutes=10)).isoformat(),
    )
    client.post("/api/companion/sessions/import", json={"document": document})

    status = client.get(f"/api/companion/sessions/{document['manifest']['session_id']}").json()
    note = get_patient_by_id(status["encounter_id"])
    expected = local_half_past_midnight.astimezone().date().isoformat()
    assert note["encounter_date"] == expected


def test_presence_reports_are_instant():
    # No host: nothing connected.
    assert client.get("/api/companion/status").json()["phone"]["connected"] is False

    # The host reports a phone attach directly — no waiting for the next
    # (up to 20s-held) poll to carry the count.
    client.post("/api/companion/host/presence", json={"phones": 1, "name": "Filipe's Mac"})
    phone = client.get("/api/companion/status").json()["phone"]
    assert phone["connected"] is True and phone["phones"] == 1
