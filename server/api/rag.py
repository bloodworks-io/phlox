import logging
import os

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    UploadFile,
)

from server.constants import TEMP_DIR
from server.schemas.rag import (
    CommitRequest,
    DeleteFileRequest,
    ModifyCollectionRequest,
)
from server.utils.rag.chroma import CHROMADB_AVAILABLE, ChromaManager
from server.utils.rag.processing import (
    generate_specialty_suggestions,
)

router = APIRouter()

# Only initialize chroma_manager if dependencies are available
if CHROMADB_AVAILABLE:
    chroma_manager = ChromaManager()
else:
    chroma_manager = None


logger = logging.getLogger(__name__)


# Helper function to check if RAG is available
def _check_rag_available():
    if not CHROMADB_AVAILABLE or chroma_manager is None:
        raise HTTPException(
            status_code=503,
            detail="RAG features are not available.",
        )


@router.get("/files")
async def get_files():
    """API endpoint to retrieve the list of document collections."""
    _check_rag_available()
    try:
        collections = chroma_manager.list_collections()
        return {"files": collections}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching collections: {str(e)}"
        )


@router.get("/collection_files/{collection_name}")
async def get_collection_files(collection_name: str):
    """API endpoint to retrieve files for a specific collection."""
    _check_rag_available()
    try:
        files = chroma_manager.get_files_for_collection(collection_name)
        return {"files": files}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching files for collection '{collection_name}': {str(e)}",
        )


@router.post("/modify")
async def modify_collection(request: ModifyCollectionRequest):
    """API endpoint to modify the name of a collection."""
    _check_rag_available()
    try:
        success = chroma_manager.modify_collection_name(
            request.old_name, request.new_name
        )
        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to rename collection"
            )
        return {"message": "Collection renamed successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error renaming collection: {str(e)}"
        )


@router.delete("/delete-collection/{name}")
async def delete_collection_endpoint(name: str):
    """API endpoint to delete a collection."""
    _check_rag_available()
    try:
        success = chroma_manager.delete_collection(name)
        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to delete collection"
            )
        return {"message": "Collection deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error deleting collection: {str(e)}"
        )


@router.delete("/delete-file")
async def delete_file_endpoint(request: DeleteFileRequest):
    """API endpoint to delete a file from a collection."""
    _check_rag_available()
    try:
        success = chroma_manager.delete_file_from_collection(
            request.collection_name, request.file_name
        )
        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to delete file from collection"
            )
        return {"message": "File deleted from collection successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting file from collection: {str(e)}",
        )


@router.post("/extract-pdf-info")
async def extract_pdf_info(file: UploadFile = File(...)):
    """API endpoint to extract information from a PDF."""
    _check_rag_available()
    logger.info(
        f"Request received for /extract-pdf-info: filename='{file.filename}'"
    )
    temp_dir = TEMP_DIR
    os.makedirs(temp_dir, exist_ok=True)  # Ensure temp dir exists
    file_location = os.path.join(temp_dir, file.filename)

    if not file.filename:
        logger.error("Received /extract-pdf-info request with no filename.")
        raise HTTPException(
            status_code=400, detail="No filename provided in upload."
        )

    try:
        # Save the uploaded file temporarily
        logger.debug(f"Saving uploaded file to '{file_location}'")
        with open(file_location, "wb") as f:
            content = await file.read()
            f.write(content)
        logger.debug(f"File saved successfully. Size: {len(content)} bytes.")

        # Extract text from the PDF (synchronous)
        logger.info(f"Extracting text from '{file_location}'")
        extracted_text = chroma_manager.extract_text_from_pdf(file_location)
        if not extracted_text:
            logger.warning(
                f"No text extracted from PDF '{file.filename}'. It might be empty or image-based."
            )
            # Decide how to handle: proceed with empty text, or raise error?
            # Raising error might be better if text is essential.
            raise HTTPException(
                status_code=400,
                detail=f"Could not extract text from PDF '{file.filename}'. Check if it's searchable.",
            )

        logger.debug(
            f"Text extracted. Length: {len(extracted_text)}. Storing temporarily."
        )
        chroma_manager.set_extracted_text(
            extracted_text
        )  # Store for potential commit later

        # --- Await the async LLM calls ---
        logger.info("Attempting to determine disease name...")
        disease_name = await chroma_manager.get_disease_name(extracted_text)
        logger.info(f"Disease name determined: '{disease_name}'")

        logger.debug("Attempting to determine focus area...")
        focus_area = await chroma_manager.get_focus_area(extracted_text)
        logger.debug(f"Focus area determined: '{focus_area}'")

        logger.debug("Attempting to determine document source...")
        document_source = await chroma_manager.get_document_source(
            extracted_text
        )
        logger.debug(f"Document source determined: '{document_source}'")
        # --- End of awaited calls ---

        filename = file.filename  # Keep original filename

        logger.info(
            f"PDF processing complete for '{filename}': disease='{disease_name}', focus='{focus_area}', source='{document_source}'"
        )

        # Return the extracted information. The text itself is stored in chroma_manager instance
        # and will be used by commit_to_vectordb if called next.
        return {
            "disease_name": disease_name,
            "focus_area": focus_area,
            "document_source": document_source,
            "filename": filename,
            # Optionally include a snippet or confirmation message
            "message": "PDF information extracted. Ready for commit.",
        }
    except HTTPException as http_exc:
        # Re-raise HTTPExceptions specifically
        raise http_exc
    except Exception as e:
        logger.error(
            f"Error processing PDF '{file.filename}': {e}", exc_info=True
        )
        raise HTTPException(
            status_code=500, detail=f"Error processing PDF: {str(e)}"
        )
    finally:
        # Ensure the temporary file is always removed
        if os.path.exists(file_location):
            try:
                logger.debug(f"Removing temporary file '{file_location}'")
                os.remove(file_location)
            except OSError as e:
                logger.error(
                    f"Error removing temporary file '{file_location}': {e}",
                    exc_info=True,
                )


@router.post("/commit-to-vectordb")
async def commit_to_db(request: CommitRequest):
    """API endpoint to commit data to the database."""
    _check_rag_available()
    try:
        chroma_manager.commit_to_vectordb(
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
        )


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
        )


@router.post("/clear-database")
async def clear_database():
    """API endpoint to clear the entire RAG database."""
    _check_rag_available()
    try:
        success = chroma_manager.reset_database()
        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to reset RAG database"
            )
        return {"message": "RAG database cleared successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error clearing RAG database: {str(e)}"
        )
