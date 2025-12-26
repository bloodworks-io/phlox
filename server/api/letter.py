import logging
from typing import List

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import JSONResponse

from server.database.entities.letter import (
    delete_letter_template,
    fetch_patient_letter,
    get_letter_template_by_id,
    get_letter_templates,
    reset_default_templates,
    save_letter_template,
    update_letter_template,
    update_patient_letter,
)
from server.schemas.letter import LetterRequest, LetterSave, LetterTemplate
from server.utils.nlp_tools.letter import generate_letter_content

router = APIRouter()


@router.post("/generate")
async def generate_letter(request: LetterRequest):
    """Generates a letter."""

    try:
        letter_content = await generate_letter_content(
            request.patientName,
            request.gender,
            request.dob,
            request.template_data,
            request.additional_instruction,
            request.context,
        )
        return JSONResponse(content={"letter": letter_content})
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"Unexpected error in generate_letter endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


@router.post("/save")
async def save_letter(request: LetterSave):
    """Saves a letter."""
    try:
        update_patient_letter(request.patientId, request.letter)
        logging.info(f"Patient letter updated for ID: {request.patientId}")
        return {"message": "Letter saved successfully"}
    except Exception as e:
        logging.error(f"Error updating patient letter: {e}")
        raise HTTPException(status_code=500, detail=e)


@router.get("/fetch-letter")
async def fetch_letter(patientId: int):
    """Fetches a letter by patient ID."""
    try:
        letter = await fetch_patient_letter(patientId)
        return JSONResponse(
            content={"letter": letter or "No letter attached to encounter"}
        )
    except Exception as e:
        logging.error(f"Error fetching letter: {e}")
        raise HTTPException(status_code=500, detail=e)


@router.get("/templates")
async def get_templates() -> List[LetterTemplate]:
    """Get all letter templates."""
    try:
        templates = get_letter_templates()

        # Get default template ID from user settings
        from server.database.config.manager import config_manager

        user_settings = config_manager.get_user_settings()
        default_template_id = user_settings.get("default_letter_template_id")

        # Add default indicator to the templates response
        return JSONResponse(
            content={
                "templates": templates,
                "default_template_id": default_template_id,
            }
        )
    except Exception as e:
        logging.error(f"Error fetching letter templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/{template_id}")
async def get_template(template_id: int) -> LetterTemplate:
    """Get a letter template by ID."""
    try:
        template = get_letter_template_by_id(template_id)
        if template is None:
            raise HTTPException(status_code=404, detail="Template not found")
        return JSONResponse(content=template)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching letter template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates")
async def create_template(template: LetterTemplate = Body(...)) -> dict:
    """Create a letter template."""
    try:
        template_id = save_letter_template(template)
        return JSONResponse(
            content={
                "id": template_id,
                "message": "Template created successfully",
            }
        )
    except Exception as e:
        logging.error(f"Error creating letter template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates/reset")
async def reset_templates() -> dict:
    """Reset letter templates to default."""
    try:
        reset_default_templates()
        return JSONResponse(content={"message": "Templates reset to defaults"})
    except Exception as e:
        logging.error(f"Error resetting letter templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/templates/{template_id}")
async def update_template(
    template_id: int, template: LetterTemplate = Body(...)
) -> dict:
    """Update a letter template."""
    try:
        success = update_letter_template(template_id, template)
        if not success:
            raise HTTPException(status_code=404, detail="Template not found")
        return JSONResponse(
            content={"message": "Template updated successfully"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating letter template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/templates/{template_id}")
async def delete_template(template_id: int) -> dict:
    """Delete a letter template."""
    try:
        success = delete_letter_template(template_id)
        if not success:
            raise HTTPException(status_code=404, detail="Template not found")
        return JSONResponse(
            content={"message": "Template deleted successfully"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting letter template: {e}")
        raise HTTPException(status_code=500, detail=str(e))
