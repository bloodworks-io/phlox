import logging

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    Response,
    UploadFile,
)
from pydantic import BaseModel

from server.constants import TEMP_DIR
from server.schemas.rag import (
    BulkCommitRequest,
    CommitRequest,
    DeleteFileRequest,
    ModifyCollectionRequest,
)
from server.utils.rag.processing import (
    generate_specialty_suggestions,
)
from server.utils.rag.vector_store import VECTOR_STORE_AVAILABLE, get_vector_store_manager

router = APIRouter()

logger = logging.getLogger(__name__)


class ExtractTextPayload(BaseModel):
    extracted_text: str
    filename: str


async def _extract_rag_metadata_from_text(
    vector_store_manager, extracted_text: str, filename: str
) -> dict:
    """Shared helper to derive RAG metadata from extracted text and stage it for commit."""
    if not extracted_text or not extracted_text.strip():
        raise HTTPException(
            status_code=400,
            detail=f"Could not extract text from PDF '{filename}'. Check if it's searchable.",
        )

    logger.debug(f"Text extracted. Length: {len(extracted_text)}. Storing temporarily.")
    vector_store_manager.set_extracted_text(extracted_text)

    logger.info("Attempting to determine disease name...")
    disease_name = await vector_store_manager.get_disease_name(extracted_text)
    logger.info(f"Disease name determined: '{disease_name}'")

    logger.debug("Attempting to determine focus area...")
    focus_area = await vector_store_manager.get_focus_area(extracted_text)
    logger.debug(f"Focus area determined: '{focus_area}'")

    logger.debug("Attempting to determine document source...")
    document_source = await vector_store_manager.get_document_source(extracted_text)
    logger.debug(f"Document source determined: '{document_source}'")

    logger.info(
        f"PDF processing complete for '{filename}': disease='{disease_name}', focus='{focus_area}', source='{document_source}'"
    )

    return {
        "disease_name": disease_name,
        "focus_area": focus_area,
        "document_source": document_source,
        "filename": filename,
        "message": "PDF information extracted. Ready for commit.",
    }


# Helper function to check if RAG is available
def _check_rag_available():
    if not VECTOR_STORE_AVAILABLE or get_vector_store_manager() is None:
        raise HTTPException(
            status_code=503,
            detail="RAG features are not available.",
        )


@router.get("/files")
async def get_files():
    """API endpoint to retrieve the list of document collections."""
    _check_rag_available()
    try:
        vector_store_manager = get_vector_store_manager()
        collections = vector_store_manager.list_collections()
        return {"files": collections}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching collections: {str(e)}") from e


@router.get("/collection_files/{collection_name}")
async def get_collection_files(collection_name: str):
    """API endpoint to retrieve files for a specific collection."""
    _check_rag_available()
    try:
        vector_store_manager = get_vector_store_manager()
        files = vector_store_manager.get_files_for_collection_with_pdf_flag(collection_name)
        return {"files": files}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching files for collection '{collection_name}': {str(e)}",
        ) from e


@router.post("/modify")
async def modify_collection(request: ModifyCollectionRequest):
    """API endpoint to modify the name of a collection."""
    _check_rag_available()
    try:
        vector_store_manager = get_vector_store_manager()
        success = vector_store_manager.modify_collection_name(request.old_name, request.new_name)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to rename collection")
        return {"message": "Collection renamed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error renaming collection: {str(e)}") from e


@router.delete("/delete-collection/{name}")
async def delete_collection_endpoint(name: str):
    """API endpoint to delete a collection."""
    _check_rag_available()
    try:
        vector_store_manager = get_vector_store_manager()
        success = vector_store_manager.delete_collection(name)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete collection")
        return {"message": "Collection deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting collection: {str(e)}") from e


@router.delete("/delete-file")
async def delete_file_endpoint(request: DeleteFileRequest):
    """API endpoint to delete a file from a collection."""
    _check_rag_available()
    try:
        vector_store_manager = get_vector_store_manager()
        success = vector_store_manager.delete_file_from_collection(
            request.collection_name, request.file_name
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete file from collection")
        return {"message": "File deleted from collection successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting file from collection: {str(e)}",
        ) from e


@router.get("/download-pdf/{collection_name}/{filename}")
async def download_pdf(collection_name: str, filename: str):
    """Download the original PDF stored for a file in a collection."""
    _check_rag_available()
    try:
        vector_store_manager = get_vector_store_manager()
        pdf_bytes = vector_store_manager.get_stored_pdf(collection_name, filename)
        if pdf_bytes is None:
            raise HTTPException(
                status_code=404,
                detail=f"No stored PDF found for '{filename}' in collection '{collection_name}'",
            )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving PDF: {str(e)}",
        ) from e


@router.post("/extract-pdf-info")
async def extract_pdf_info(file: UploadFile = File(...)):
    """API endpoint to extract information from a PDF."""
    _check_rag_available()
    vector_store_manager = get_vector_store_manager()
    logger.info(f"Request received for /extract-pdf-info: filename='{file.filename}'")
    temp_dir = TEMP_DIR
    temp_dir.mkdir(parents=True, exist_ok=True)  # Ensure temp dir exists
    file_location = temp_dir / file.filename

    if not file.filename:
        logger.error("Received /extract-pdf-info request with no filename.")
        raise HTTPException(status_code=400, detail="No filename provided in upload.")

    try:
        # Save the uploaded file temporarily
        logger.debug(f"Saving uploaded file to '{file_location}'")
        with file_location.open("wb") as f:
            content = await file.read()
            f.write(content)
        logger.debug(f"File saved successfully. Size: {len(content)} bytes.")

        # Stage raw PDF bytes for optional storage
        vector_store_manager.set_extracted_pdf(content)

        # Extract text from the PDF (synchronous)
        logger.info(f"Extracting text from '{file_location}'")
        extracted_text = vector_store_manager.extract_text_from_pdf(file_location)
        if not extracted_text:
            logger.warning(
                f"No text extracted from PDF '{file.filename}'. It might be empty or image-based."
            )

        return await _extract_rag_metadata_from_text(
            vector_store_manager=vector_store_manager,
            extracted_text=extracted_text,
            filename=file.filename,
        )
    except HTTPException as http_exc:
        # Re-raise HTTPExceptions specifically
        raise http_exc
    except Exception as e:
        logger.error(f"Error processing PDF '{file.filename}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}") from e
    finally:
        # Ensure the temporary file is always removed
        if file_location.exists():
            try:
                logger.debug(f"Removing temporary file '{file_location}'")
                file_location.unlink()
            except OSError as e:
                logger.error(
                    f"Error removing temporary file '{file_location}': {e}",
                    exc_info=True,
                )


@router.post("/extract-pdf-info-from-text")
async def extract_pdf_info_from_text(payload: ExtractTextPayload):
    """API endpoint to extract metadata from already-extracted PDF text (frontend text-first flow)."""
    _check_rag_available()
    vector_store_manager = get_vector_store_manager()

    logger.info(
        "Request received for /extract-pdf-info-from-text: filename='%s', text_length=%d",
        payload.filename,
        len(payload.extracted_text or ""),
    )

    try:
        return await _extract_rag_metadata_from_text(
            vector_store_manager=vector_store_manager,
            extracted_text=payload.extracted_text,
            filename=payload.filename,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error processing extracted text for '{payload.filename}': {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500, detail=f"Error processing extracted text: {str(e)}"
        ) from e


@router.post("/commit-to-vectordb")
async def commit_to_db(request: CommitRequest):
    """API endpoint to commit data to the database."""
    _check_rag_available()
    try:
        vector_store_manager = get_vector_store_manager()
        vector_store_manager.commit_to_vectordb(
            request.disease_name,
            request.focus_area,
            request.document_source,
            request.filename,
        )

        return {"message": "Data committed to the database successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error committing data to database: {str(e)}",
        ) from e


@router.post("/commit-direct")
async def commit_direct(request: BulkCommitRequest):
    """API endpoint to commit a document with pre-extracted text in a single call.

    Used by the bulk upload path.
    """
    _check_rag_available()
    try:
        vector_store_manager = get_vector_store_manager()
        vector_store_manager.commit_text_to_vectordb(
            extracted_text=request.extracted_text,
            disease_name=request.disease_name,
            focus_area=request.focus_area,
            document_source=request.document_source,
            filename=request.filename,
        )
        return {
            "message": "Data committed to the database successfully",
            "filename": request.filename,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error committing data to database: {str(e)}",
        ) from e


@router.post("/re-embed")
async def re_embed():
    """API endpoint to re-embed all collections with the current embedding model."""
    _check_rag_available()
    try:
        vector_store_manager = get_vector_store_manager()
        result = vector_store_manager.re_embed_all()
        return {"message": "Re-embedding completed successfully", **result}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error during re-embedding: {str(e)}",
        ) from e


@router.get("/suggestions")
async def get_rag_suggestions():
    """Get specialty-specific RAG chat suggestions."""
    _check_rag_available()
    try:
        suggestions = await generate_specialty_suggestions()
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating suggestions: {str(e)}"
        ) from e


@router.post("/clear-database")
async def clear_database():
    """API endpoint to clear the entire RAG database."""
    _check_rag_available()
    try:
        vector_store_manager = get_vector_store_manager()
        success = vector_store_manager.reset_database()
        if not success:
            raise HTTPException(status_code=500, detail="Failed to reset RAG database")
        return {"message": "RAG database cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing RAG database: {str(e)}") from e
