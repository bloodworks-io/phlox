import logging
from typing import List, Optional

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import JSONResponse

from server.database.entities.templates import (
    get_all_templates,
    get_default_template,
    get_template_by_key,
    save_template,
    set_default_template,
    soft_delete_template,
    template_exists,
    update_template,
)
from server.schemas.templates import AdaptiveRefinementRequest, ClinicalTemplate
from server.utils.nlp_tools.templates import generate_template_from_note

router = APIRouter()


@router.post("/default/{template_key}")
async def set_default_template_endpoint(template_key: str):
    """Set the default template."""
    try:
        set_default_template(template_key)
        return JSONResponse(
            content={"message": f"Set {template_key} as default template"}
        )
    except Exception as e:
        logging.error(f"Error setting default template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/default")
async def get_default_template_endpoint():
    """Get the default template key."""
    try:
        template = get_default_template()
        if template is None:
            raise HTTPException(
                status_code=404, detail="No default template set"
            )
        return JSONResponse(content={"template_key": template["template_key"]})
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"Error getting default template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{template_key}")
async def get_template(template_key: str):
    """Get a specific template by its key."""
    try:
        template = get_template_by_key(template_key)
        if template is None:
            raise HTTPException(status_code=404, detail="Template not found")
        return JSONResponse(content=template)
    except Exception as e:
        logging.error(f"Error fetching template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{template_key}")
async def delete_template(template_key: str):
    """Delete a template if it's not a default template."""
    try:
        if template_key.startswith(("phlox_", "soap_", "progress_")):
            raise HTTPException(
                status_code=403, detail="Cannot delete default templates"
            )

        success = soft_delete_template(template_key)
        if success:
            return JSONResponse(
                content={"message": f"Template {template_key} deleted"}
            )
        raise HTTPException(status_code=404, detail="Template not found")
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"Error deleting template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{template_key}/fields/{field_key}/adaptive-instructions/reset")
async def reset_adaptive_instructions(template_key: str, field_key: str):
    """
    Reset (clear) the adaptive refinement instructions for a given field in a template.
    """
    from server.database.entities.templates import (
        update_field_adaptive_instructions,
    )

    result = update_field_adaptive_instructions(template_key, field_key, [])
    if result:
        return JSONResponse(
            content={
                "message": f"Adaptive instructions for field '{field_key}' in template '{template_key}' have been reset."
            }
        )
    else:
        raise HTTPException(
            status_code=404,
            detail="Template or field not found, or update failed",
        )


@router.post(
    "/{template_key}/fields/{field_key}/adaptive-instructions/consolidate"
)
async def consolidate_adaptive_instructions_endpoint(
    template_key: str, field_key: str
):
    """
    Consolidate the adaptive refinement instructions for a given field in a template.
    This resolves contradictions, merges redundancy, and simplifies complex instructions.
    """
    from server.database.entities.templates import (
        get_template_by_key,
        update_field_adaptive_instructions,
    )
    from server.utils.nlp_tools.adaptive_refinement import (
        consolidate_adaptive_instructions,
    )

    # Get the template to find the field
    template_data = get_template_by_key(template_key, exact_match=True)
    if not template_data:
        raise HTTPException(status_code=404, detail="Template not found")

    # Find the specific field
    target_field = None
    for field in template_data.get("fields", []):
        if field.get("field_key") == field_key:
            target_field = field
            break

    if not target_field:
        raise HTTPException(
            status_code=404,
            detail=f"Field '{field_key}' not found in template",
        )

    # Get current instructions
    previous_instructions = target_field.get(
        "adaptive_refinement_instructions", []
    )

    if not previous_instructions:
        return JSONResponse(
            content={
                "message": "No instructions to consolidate",
                "previous_instructions": [],
                "consolidated_instructions": [],
                "changes_made": [],
                "reason": "No instructions present",
            }
        )

    # Run consolidation
    consolidation_result = await consolidate_adaptive_instructions(
        instructions=previous_instructions,
        field_key=field_key,
        field_name=target_field.get("field_name", field_key),
    )

    # Save the consolidated instructions
    save_success = update_field_adaptive_instructions(
        template_key=template_key,
        field_key=field_key,
        new_instructions=consolidation_result["consolidated_instructions"],
    )

    if not save_success:
        raise HTTPException(
            status_code=500,
            detail="Failed to save consolidated instructions",
        )

    return JSONResponse(
        content={
            "message": f"Adaptive instructions for field '{field_key}' in template '{template_key}' have been consolidated.",
            "previous_instructions": previous_instructions,
            "consolidated_instructions": consolidation_result[
                "consolidated_instructions"
            ],
            "changes_made": consolidation_result["changes_made"],
            "reason": consolidation_result["reason"],
        }
    )


@router.get("")
async def get_templates():
    """Get all available templates."""
    try:
        templates = get_all_templates()
        templates_list = (
            list(templates) if isinstance(templates, dict) else templates
        )
        return JSONResponse(content=templates_list)
    except Exception as e:
        logging.error(f"Error fetching templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def save_templates(
    templates: List[dict] = Body(..., description="List of templates to save")
):
    """Save or update multiple templates."""
    try:
        template_objects = [
            ClinicalTemplate(**template) for template in templates
        ]
        results = []
        updated_keys = {}

        for template in template_objects:
            if template_exists(template.template_key):
                new_key = update_template(template)
                if new_key == template.template_key:
                    results.append(
                        f"No changes detected for template: {template.template_name}"
                    )
                else:
                    results.append(
                        f"Updated template: {template.template_name}"
                    )
                updated_keys[template.template_key] = new_key
            else:
                save_template(template)
                results.append(f"Created template: {template.template_name}")
                updated_keys[template.template_key] = template.template_key

        return JSONResponse(
            content={
                "message": "Templates processed successfully",
                "details": results,
                "updated_keys": updated_keys,
            }
        )
    except Exception as e:
        logging.error(f"Error saving templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate")
async def generate_template(request_body: dict):
    """Generate a template from an example note."""
    example_note = request_body.get("exampleNote")
    if not example_note:
        raise HTTPException(status_code=400, detail="Example note is required")

    try:
        generated_template = await generate_template_from_note(example_note)
        save_template(generated_template)
        return JSONResponse(content=generated_template.dict())
    except Exception as e:
        logging.error(f"Error generating template from example: {e}")
        raise HTTPException(status_code=500, detail=str(e))
