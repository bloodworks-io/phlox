import asyncio
import json
import logging
import traceback

from fastapi import APIRouter, BackgroundTasks, Body
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from server.database.entities.analysis import generate_previous_visit_summary
from server.database.entities.jobs import (
    count_incomplete_jobs,
    generate_jobs_list_from_plan,
    get_patients_with_outstanding_jobs,
    update_patient_jobs_list,
)
from server.database.entities.patient import (
    delete_patient_by_id,
    get_patient_by_id,
    get_patient_history,
    get_patients_by_date,
    get_scribe_consent,
    save_patient,
    search_patients,
    set_scribe_consent,
    update_patient,
    update_patient_reasoning,
    update_patient_summary,
)
from server.database.entities.templates import (
    get_template_by_key,
    update_field_adaptive_instructions,
)
from server.schemas.patient import (
    JobExtractionRequest,
    JobsListUpdate,
    Patient,
    SavePatientRequest,
    ScribeConsentRequest,
)
from server.utils.nlp_tools.adaptive_refinement import (
    generate_adaptive_refinement_suggestions,
)
from server.utils.nlp_tools.jobs import extract_jobs_from_plan
from server.utils.nlp_tools.summarisation import summarise_encounter
from server.utils.nlp_tools.summarization_manager import summarization_manager

router = APIRouter()

# Lock to prevent concurrent adaptive refinement operations
_adaptive_refinement_lock = asyncio.Lock()
_adaptive_refinement_running = False


@router.get("/consent")
async def get_consent(ur_number: str):
    """Return the ambient-scribe consent state for a patient (keyed by ur_number)."""
    try:
        consent = get_scribe_consent(ur_number)
        if consent is None:
            return {"scribe_consent_at": None, "scribe_consent_declined_at": None}
        return JSONResponse(content=consent)
    except Exception as e:
        logging.error(f"Error fetching scribe consent: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/consent")
async def set_consent(request: ScribeConsentRequest):
    """Record a patient's ambient-scribe consent decision and return the new state."""
    try:
        consent = set_scribe_consent(request.ur_number, request.consented)
        return JSONResponse(content=consent)
    except Exception as e:
        logging.error(f"Error setting scribe consent: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/save")
async def save_patient_data(request: SavePatientRequest, background_tasks: BackgroundTasks):
    """Saves patient data immediately and processes summarization in background.

    The save operation returns quickly without waiting for LLM calls.
    Encounter summarization and primary condition extraction happen asynchronously.
    """
    patient = request.patientData

    try:
        # Generate task token for deduplication
        task_token = summarization_manager.generate_token()

        # Clear summary fields - will be populated in background
        patient.encounter_summary = None
        patient.primary_condition = None

        # Save or update the patient immediately (no LLM call)
        if patient.id:
            update_patient(patient)
            logging.info(f"Patient updated with ID: {patient.id}")
            note_id = patient.id
        else:
            note_id = save_patient(patient)
            logging.info(f"Patient saved with ID: {note_id}")

        # Queue background summarization
        background_tasks.add_task(
            process_encounter_summarization,
            note_id=note_id,
            patient_data=patient,
            task_token=task_token,
        )

        # Process adaptive refinement if provided (also non-blocking)
        if request.adaptive_refinement:
            background_tasks.add_task(
                process_adaptive_refinement,
                template_key=patient.template_key or "",
                refinement_data=request.adaptive_refinement,
            )

        # Small delay for UI feedback - makes the save feel intentional
        await asyncio.sleep(0.3)

        return {"id": note_id}
    except Exception as e:
        logging.error(f"Error processing patient data: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


async def process_encounter_summarization(
    note_id: int,
    patient_data: Patient,
    task_token: str,
) -> None:
    """Process encounter summarization in background with deduplication.

    This function runs as a background task after the patient is saved.
    It checks if the task is still the latest one for this patient before
    proceeding, to avoid redundant LLM calls.

    Args:
        note_id: The ID of the patient to summarize.
        patient_data: The patient data (captured at save time).
        task_token: The unique token for this task (timestamp).
    """
    # Check if this task is still the latest one for this patient
    if not await summarization_manager.should_process(note_id, task_token):
        logging.info(f"Skipping stale summarization task for patient {note_id}")
        return

    try:
        logging.info(f"Processing summarization for patient {note_id}")

        # Perform the actual summarization (LLM calls)
        encounter_summary, primary_condition = await summarise_encounter(patient=patient_data)

        # Update the patient record with the summary
        update_patient_summary(note_id, encounter_summary, primary_condition)

        logging.info(f"Completed summarization for patient {note_id}")
    except Exception as e:
        logging.error(f"Error in background summarization for patient {note_id}: {e}")
    finally:
        await summarization_manager.mark_complete(note_id)


async def process_adaptive_refinement(template_key: str, refinement_data: dict):
    """Process adaptive refinement for multiple fields."""
    global _adaptive_refinement_running

    async with _adaptive_refinement_lock:
        if _adaptive_refinement_running:
            logging.info("Adaptive refinement already in progress, skipping this request")
            return

        _adaptive_refinement_running = True

    try:
        logging.info(
            f"Processing adaptive refinement for template '{template_key}' with {len(refinement_data)} fields"
        )

        # Get the template to validate it exists
        template_data = get_template_by_key(template_key, exact_match=False)
        if not template_data:
            logging.warning(f"Template '{template_key}' not found for adaptive refinement")
            return

        for field_key, refinement_request in refinement_data.items():
            try:
                # Find the specific field in the template
                target_field_data = None
                if "fields" in template_data and isinstance(template_data["fields"], list):
                    for field_dict in template_data["fields"]:
                        if field_dict.get("field_key") == field_key:
                            target_field_data = field_dict
                            break

                if not target_field_data:
                    logging.warning(
                        f"Field '{field_key}' not found in template '{template_key}' - skipping refinement"
                    )
                    continue

                existing_instructions = target_field_data.get("adaptive_refinement_instructions")
                logging.info(
                    f"Processing refinement for field '{field_key}' with existing adaptive refinement instructions."
                )

                # Generate updated instructions
                updated_instructions = await generate_adaptive_refinement_suggestions(
                    initial_content=refinement_request.initial_content,
                    modified_content=refinement_request.modified_content,
                    existing_instructions=existing_instructions,
                )

                # Save the updated instructions
                save_success = update_field_adaptive_instructions(
                    template_key=template_data["template_key"],
                    field_key=field_key,
                    new_instructions=updated_instructions,
                )

                if save_success:
                    logging.info(
                        f"Successfully updated adaptive instructions for field '{field_key}'"
                    )
                else:
                    logging.error(f"Failed to save adaptive instructions for field '{field_key}'")

            except Exception as e:
                logging.error(f"Error processing adaptive refinement for field '{field_key}': {e}")
                # Continue processing other fields even if one fails
                continue
    finally:
        async with _adaptive_refinement_lock:
            _adaptive_refinement_running = False


@router.get("/list")
async def get_patients(
    date: str,
    template_key: str | None = None,
    detailed: str | None = None,
):
    """Get patients for a specific date."""
    try:
        include_data: bool = detailed is not None and detailed.lower() == "true"
        patients = get_patients_by_date(date, template_key, include_data)

        if include_data:
            return JSONResponse(
                content=[
                    {
                        "id": patient["id"],
                        "name": patient["name"],
                        "ur_number": patient["ur_number"],
                        "jobs_list": (
                            json.dumps(patient["jobs_list"])
                            if isinstance(patient.get("jobs_list"), list)
                            else patient.get("jobs_list", "[]")
                        ),
                        "encounter_summary": patient.get("encounter_summary", ""),
                        "dob": patient["dob"],
                        "reasoning": patient.get("reasoning_output"),  # Add this line
                    }
                    for patient in patients
                ]
            )

        # Basic response
        return JSONResponse(
            content=[
                {
                    "id": patient["id"],
                    "name": patient["name"],
                    "ur_number": patient["ur_number"],
                }
                for patient in patients
            ]
        )

    except Exception as e:
        logging.error(f"Error fetching patients: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/id/{id}")
async def get_patient(id: int, include_history: bool = False):
    """Get patient by ID with option to include history."""
    try:
        patient = get_patient_by_id(id)

        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found")

        if include_history:
            history = get_patient_history(patient["ur_number"])
            patient["history"] = history

        return JSONResponse(content=patient)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching patient: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error") from e


@router.get("/id/{id}/history")
async def get_patient_history_endpoint(id: int):
    """Get patient's historical encounters with persistent fields."""
    try:
        patient = get_patient_by_id(id)
        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found")

        history = get_patient_history(patient["ur_number"])
        return JSONResponse(content=history)
    except Exception as e:
        logging.error(f"Error fetching patient history: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/search")
async def search_patient(q: str | None = None, ur_number: str | None = None):
    """Search patients by UR number (exact) or name (substring). Accepts a
    generic `q` (UR or name) or, for backward compatibility, `ur_number`."""
    query = q if q is not None else ur_number
    if not query:
        raise HTTPException(status_code=400, detail="q or ur_number is required")
    try:
        patients = search_patients(query)
        return JSONResponse(content=patients)
    except Exception as e:
        logging.error(f"Error searching patients: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/history")
async def get_history_by_ur_number(ur_number: str, template_key: str | None = None):
    """Get patient's historical encounters by UR number, optionally filtered by template type."""
    try:
        history = get_patient_history(ur_number, template_key)
        return JSONResponse(content=history)
    except Exception as e:
        logging.error(f"Error fetching patient history: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/summary/{id}")
async def get_patient_summary(id: int):
    """Get patient summary."""
    try:
        patient = get_patient_by_id(id)

        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found")

        summary = await generate_previous_visit_summary(patient)
        return JSONResponse(content={"summary": summary})
    except Exception as e:
        logging.error(f"Error getting patient summary: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/id/{id}")
async def delete_patient(id: int):
    """Delete a patient record."""
    try:
        success = delete_patient_by_id(id)
        if success:
            return {"message": "Patient deleted"}
        raise HTTPException(status_code=404, detail="Patient not found")
    except Exception as e:
        logging.error(f"Error deleting patient: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/update-jobs-list")
async def update_jobs_list(update: JobsListUpdate):
    """Update a patient's job list."""

    try:
        update_patient_jobs_list(update.noteId, update.jobsList)

        return {"id": update.noteId}
    except Exception as e:
        logging.error(f"Error processing to-do list update: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/extract-jobs")
async def extract_jobs(request: JobExtractionRequest):
    """Extract curated, actionable jobs from a plan string (Wrap Up modal)."""
    plan = (request.plan or "").strip()
    if not plan:
        return {"action_items": [], "excluded": [], "fallback": "empty"}

    try:
        result = await extract_jobs_from_plan(plan)

        # Model failure / nothing usable -> fall back to the basic splitter
        if not result.action_items and not result.excluded:
            dumb = json.loads(generate_jobs_list_from_plan(plan))
            return {
                "action_items": [
                    {"text": j["job"], "category": "action", "rationale": None} for j in dumb
                ],
                "excluded": [],
                "fallback": "heuristic",
            }

        return {
            "action_items": [item.model_dump() for item in result.action_items],
            "excluded": [item.model_dump() for item in result.excluded],
            "fallback": None,
        }
    except Exception as e:
        logging.error(f"Error extracting jobs: {e}")
        dumb = json.loads(generate_jobs_list_from_plan(plan))
        return {
            "action_items": [
                {"text": j["job"], "category": "action", "rationale": None} for j in dumb
            ],
            "excluded": [],
            "fallback": "heuristic",
        }


@router.post("/update-jobs")
async def update_jobs(
    note_id: int,
    jobs_list: list[dict] = Body(..., description="Updated jobs list"),
):
    """Update a patient's jobs list."""
    try:
        update_patient_jobs_list(note_id, jobs_list)
        return JSONResponse(content={"message": "Jobs list updated successfully"})
    except Exception as e:
        logging.error(f"Error updating jobs list: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/update-jobs/{note_id}")
async def update_patient_jobs(
    note_id: int,
    jobs_list: list[dict] = Body(...),
):
    """Update a patient's jobs list."""
    try:
        update_patient_jobs_list(note_id, jobs_list)
        return JSONResponse(content={"message": "Jobs updated successfully"})
    except Exception as e:
        logging.error(f"Error updating patient jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/outstanding-jobs")
async def get_patients_with_jobs():
    """Get all patients with outstanding jobs."""
    try:
        patients = get_patients_with_outstanding_jobs()
        return JSONResponse(
            content=[
                {
                    "id": patient["id"],
                    "name": patient["name"],
                    "ur_number": patient["ur_number"],
                    "jobs_list": json.dumps(patient.get("jobs_list", [])),
                    "encounter_summary": patient.get("encounter_summary", ""),
                    "dob": patient["dob"],
                    "encounter_date": patient["encounter_date"],
                    "reasoning": patient.get("reasoning_output"),  # Add this line
                }
                for patient in patients
            ]
        )
    except Exception as e:
        logging.error(f"Error fetching patients with jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/incomplete-jobs-count")
async def get_incomplete_jobs_count():
    """Get the count of incomplete jobs."""
    try:
        incomplete_jobs_count = count_incomplete_jobs()
        return JSONResponse(content={"incomplete_jobs_count": incomplete_jobs_count})
    except Exception as e:
        logging.error(f"Error counting incomplete jobs: {e}")
        print("TRACEBACK:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{note_id}/reasoning/stream")
async def generate_reasoning_stream(note_id: int):
    """Run reasoning analysis with streaming status updates via Server-Sent Events."""
    try:
        patient = get_patient_by_id(note_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        async def generate():
            from server.utils.nlp_tools.reasoning import stream_clinical_reasoning_with_tools

            async for event in stream_clinical_reasoning_with_tools(
                patient["template_data"],
                patient["dob"],
                patient["encounter_date"],
                patient["gender"],
                patient.get("ur_number"),
            ):
                if event["type"] == "result":
                    # Save to database before sending
                    update_patient_reasoning(note_id, event["data"])
                yield f"data: {json.dumps(event)}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")
    except Exception as e:
        logging.error(f"Reasoning stream error: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
