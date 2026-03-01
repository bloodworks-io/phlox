from pydantic import BaseModel


class CommitRequest(BaseModel):
    """
    Represents a request to commit a new document to a collection.

    Attributes:
        disease_name (str): The name of the disease associated with the document.
        focus_area (str): The specific focus area or topic of the document.
        document_source (str): The source or origin of the document.
        filename (str): The name of the file to be committed.
    """

    disease_name: str
    focus_area: str
    document_source: str
    filename: str


class ModifyCollectionRequest(BaseModel):
    """
    Represents a request to modify the name of a collection.

    Attributes:
        old_name (str): The current name of the collection to be modified.
        new_name (str): The new name to assign to the collection.
    """

    old_name: str
    new_name: str


class DeleteFileRequest(BaseModel):
    """
    Represents a request to delete a specific file from a collection.

    Attributes:
        collection_name (str): The name of the collection containing the file.
        file_name (str): The name of the file to be deleted.
    """

    collection_name: str
    file_name: str
