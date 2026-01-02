import asyncio
import json
import logging
import traceback
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Body
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse

from server.database.entities.analysis import generate_previous_visit_summary
from server.database.entities.jobs import (
    count_incomplete_jobs,
    get_patients_with_outstanding_jobs,
    update_patient_jobs_list,
)
from server.database.entities.patient import (
    delete_patient_by_id,
    get_patient_by_id,
    get_patient_history,
    get_patients_by_date,
    save_patient,
    search_patient_by_ur_number,
    update_patient,
    update_patient_reasoning,
)
from server.database.entities.templates import (
    get_template_by_key,
    update_field_adaptive_instructions,
)
from server.schemas.patient import (
    JobsListUpdate,
    Patient,
    SavePatientRequest,
)
from server.utils.nlp_tools.adaptive_refinement import (
    generate_adaptive_refinement_suggestions,
)
from server.utils.nlp_tools.reasoning import run_clinical_reasoning
from server.utils.nlp_tools.summarisation import summarise_encounter

router = APIRouter()

# Lock to prevent concurrent adaptive refinement operations
_adaptive_refinement_lock = asyncio.Lock()
_adaptive_refinement_running = False


@router.post("/save")
async def save_patient_data(
    request: SavePatientRequest, background_tasks: BackgroundTasks
):
    """Saves patient data and processes any adaptive refinement requests."""
    patient = request.patientData

    try:
        # Summarize the encounter
        encounter_summary, primary_condition = await summarise_encounter(
            patient=patient
        )

        # Add summary data to patient
        patient.encounter_summary = encounter_summary
        patient.primary_condition = primary_condition

        # Save or update the patient
        if patient.id:
            update_patient(patient)
            logging.info(f"Patient updated with ID: {patient.id}")
            patient_id = patient.id
        else:
            patient_id = save_patient(patient)
            logging.info(f"Patient saved with ID: {patient_id}")

        # Process adaptive refinement if provided (non-blocking)
        if request.adaptive_refinement:
            background_tasks.add_task(
                process_adaptive_refinement,
                template_key=patient.template_key,
                refinement_data=request.adaptive_refinement,
            )

        return {"id": patient_id}
    except Exception as e:
        logging.error(f"Error processing patient data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def process_adaptive_refinement(template_key: str, refinement_data: dict):
    """Process adaptive refinement for multiple fields."""
    global _adaptive_refinement_running

    async with _adaptive_refinement_lock:
        if _adaptive_refinement_running:
            logging.info(
                "Adaptive refinement already in progress, skipping this request"
            )
            return

        _adaptive_refinement_running = True

    try:
        logging.info(
            f"Processing adaptive refinement for template '{template_key}' with {len(refinement_data)} fields"
        )

        # Get the template to validate it exists
        template_data = get_template_by_key(template_key, exact_match=False)
        if not template_data:
            logging.warning(
                f"Template '{template_key}' not found for adaptive refinement"
            )
            return

        for field_key, refinement_request in refinement_data.items():
            try:
                # Find the specific field in the template
                target_field_data = None
                if "fields" in template_data and isinstance(
                    template_data["fields"], list
                ):
                    for field_dict in template_data["fields"]:
                        if field_dict.get("field_key") == field_key:
                            target_field_data = field_dict
                            break

                if not target_field_data:
                    logging.warning(
                        f"Field '{field_key}' not found in template '{template_key}' - skipping refinement"
                    )
                    continue

                existing_instructions = target_field_data.get(
                    "adaptive_refinement_instructions"
                )
                logging.info(
                    f"Processing refinement for field '{field_key}' with existing adaptive refinement instructions."
                )

                # Generate updated instructions
                updated_instructions = (
                    await generate_adaptive_refinement_suggestions(
                        initial_content=refinement_request.initial_content,
                        modified_content=refinement_request.modified_content,
                        existing_instructions=existing_instructions,
                    )
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
                    logging.error(
                        f"Failed to save adaptive instructions for field '{field_key}'"
                    )

            except Exception as e:
                logging.error(
                    f"Error processing adaptive refinement for field '{field_key}': {e}"
                )
                # Continue processing other fields even if one fails
                continue
    finally:
        async with _adaptive_refinement_lock:
            _adaptive_refinement_running = False


@router.get("/list")
async def get_patients(
    date: str,
    template_key: Optional[str] = None,
    detailed: Optional[str] = None,
) -> List[Patient]:
    """Get patients for a specific date."""
    try:
        include_data = detailed and detailed.lower() == "true"
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
                        "encounter_summary": patient.get(
                            "encounter_summary", ""
                        ),
                        "dob": patient["dob"],
                        "reasoning": patient.get(
                            "reasoning_output"
                        ),  # Add this line
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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/id/{id}")
async def get_patient(id: int, include_history: bool = False) -> Patient:
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
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/id/{id}/history")
async def get_patient_history_endpoint(id: int) -> List[Patient]:
    """Get patient's historical encounters with persistent fields."""
    try:
        patient = get_patient_by_id(id)
        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found")

        history = get_patient_history(patient["ur_number"])
        return JSONResponse(content=history)
    except Exception as e:
        logging.error(f"Error fetching patient history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_patient(ur_number: str) -> List[Patient]:
    """Search for patients by UR number."""
    try:
        patients = search_patient_by_ur_number(ur_number)

        return JSONResponse(content=patients)
    except Exception as e:
        logging.error(f"Error searching patients: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-jobs-list")
async def update_jobs_list(update: JobsListUpdate):
    """Update a patient's job list."""

    try:
        update_patient_jobs_list(update.patientId, update.jobsList)

        return {"id": update.patientId}
    except Exception as e:
        logging.error(f"Error processing to-do list update: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-jobs")
async def update_jobs(
    patient_id: int,
    jobs_list: List[dict] = Body(..., description="Updated jobs list"),
):
    """Update a patient's jobs list."""
    try:
        update_patient_jobs_list(patient_id, jobs_list)
        return JSONResponse(
            content={"message": "Jobs list updated successfully"}
        )
    except Exception as e:
        logging.error(f"Error updating jobs list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-jobs/{patient_id}")
async def update_patient_jobs(
    patient_id: int,
    jobs_list: List[dict] = Body(...),
):
    """Update a patient's jobs list."""
    try:
        update_patient_jobs_list(patient_id, jobs_list)
        return JSONResponse(content={"message": "Jobs updated successfully"})
    except Exception as e:
        logging.error(f"Error updating patient jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
                    "reasoning": patient.get(
                        "reasoning_output"
                    ),  # Add this line
                }
                for patient in patients
            ]
        )
    except Exception as e:
        logging.error(f"Error fetching patients with jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/incomplete-jobs-count")
async def get_incomplete_jobs_count():
    """Get the count of incomplete jobs."""
    try:
        incomplete_jobs_count = count_incomplete_jobs()
        return JSONResponse(
            content={"incomplete_jobs_count": incomplete_jobs_count}
        )
    except Exception as e:
        logging.error(f"Error counting incomplete jobs: {e}")
        print("TRACEBACK:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{patient_id}/reasoning")
async def generate_reasoning(patient_id: int):
    """Run reasoning analysis on a completed patient note."""
    try:
        patient = get_patient_by_id(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        reasoning_output = await run_clinical_reasoning(
            patient["template_data"],
            patient["dob"],
            patient["encounter_date"],
            patient["gender"],
        )

        update_patient_reasoning(patient_id, reasoning_output.dict())

        return JSONResponse(content=reasoning_output.dict())
    except Exception as e:
        logging.error(f"Reasoning error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
