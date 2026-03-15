import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from server.database.entities.todo import (
    add_todo_item,
    delete_todo_item,
    get_todo_items,
    update_todo_item,
)
from server.schemas.dashboard import TodoItem

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check():
    """Simple health check endpoint that returns OK if the server is running."""
    return {"status": "ok"}


@router.post("/todos")
async def add_todo(todo: TodoItem):
    """Add a todo item."""
    try:
        new_todo = add_todo_item(todo.task)
        return JSONResponse(content={"todo": new_todo})
    except Exception as e:
        logging.error(f"Error adding todo item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/todos")
async def get_todos():
    """Get all todo items."""
    try:
        todos = get_todo_items()
        return JSONResponse(content={"todos": todos})
    except Exception as e:
        logging.error(f"Error fetching todo items: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/todos/{todo_id}")
async def update_todo(todo_id: int, todo: TodoItem):
    """Update a todo item."""
    try:
        updated_todo = update_todo_item(todo_id, todo.task, todo.completed)
        return JSONResponse(content={"todo": updated_todo})
    except Exception as e:
        logging.error(f"Error updating todo item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/todos/{todo_id}")
async def delete_todo(todo_id: int):
    """Delete a todo item."""
    try:
        delete_todo_item(todo_id)
        return JSONResponse(content={"message": "Todo item deleted successfully"})
    except Exception as e:
        logging.error(f"Error deleting todo item: {e}")
        raise HTTPException(status_code=500, detail=str(e))
