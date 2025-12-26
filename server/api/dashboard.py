import logging

from fastapi import APIRouter, BackgroundTasks
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from pydantic import HttpUrl, ValidationError

from server.database.config.manager import config_manager
from server.database.entities.analysis import (
    generate_daily_analysis,
    get_latest_analysis,
)
from server.database.entities.rss import (
    add_feed,
    fetch_and_insert_initial_items,
    fetch_rss_items_from_db,
    generate_and_store_digest,
    get_feeds,
    refresh_feeds,
    refresh_manager,
    remove_feed,
)
from server.database.entities.todo import (
    add_todo_item,
    delete_todo_item,
    get_todo_items,
    update_todo_item,
)
from server.schemas.dashboard import (
    RssFeed,
    RssFeedList,
    RssFeedRefreshRequest,
    TodoItem,
)
from server.utils.llm_client.client import get_llm_client
from server.utils.nlp_tools.rss import get_feed_title

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check():
    """Simple health check endpoint that returns OK if the server is running."""
    return {"status": "ok"}


@router.post("/rss/fetch")
async def fetch_rss(feed_list: RssFeedList):
    """Fetch RSS items based on feed list."""
    feed_ids = [feed.id for feed in feed_list.feeds if feed.id is not None]

    if not feed_ids:
        # If no specific feed IDs are provided, fetch from all feeds
        items = fetch_rss_items_from_db(limit=10)
    else:
        items = fetch_rss_items_from_db(feed_ids=feed_ids, limit=10)

    return {"items": items}


@router.get("/rss/title")
async def get_rss_title(url: HttpUrl):
    """Get the title of an RSS feed."""
    title = await get_feed_title(str(url))
    return {"title": title}


@router.post("/rss/add")
async def add_rss_feed(feed: RssFeed, background_tasks: BackgroundTasks):
    """Add a new RSS feed."""
    try:
        if not feed.title:
            feed.title = await get_feed_title(str(feed.url))
        feed_id = await add_feed(feed)

        # Schedule the fetching and insertion as a background task
        background_tasks.add_task(
            fetch_and_insert_initial_items, feed_id, str(feed.url)
        )

        return {"message": "Feed added successfully"}
    except ValidationError as ve:
        logger.error(f"Validation error: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in add_rss_feed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/rss/list")
async def list_rss_feeds():
    """List all RSS feeds."""
    feeds = get_feeds()
    return {"feeds": feeds}


@router.get("/rss/digest")
async def get_rss_digest():
    """Get the latest combined digest, generating a new one if necessary."""
    try:
        digest_data = await generate_and_store_digest()
        return digest_data
    except Exception as e:
        logger.error(f"Error getting digest: {e}")
        raise HTTPException(status_code=500, detail="Error getting digest")


@router.post("/rss/digest/refresh")
async def refresh_digest():
    """Force refresh the combined digest."""
    try:
        digest_data = await generate_and_store_digest(force=True)
        return digest_data
    except Exception as e:
        logger.error(f"Error refreshing digest: {e}")
        raise HTTPException(status_code=500, detail="Error refreshing digest")


@router.delete("/rss/remove/{feed_id}")
async def remove_rss_feed(feed_id: int):
    """Remove an RSS feed."""
    try:
        remove_feed(feed_id)
        return {"message": "Feed removed successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


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
        return JSONResponse(
            content={"message": "Todo item deleted successfully"}
        )
    except Exception as e:
        logging.error(f"Error deleting todo item: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rss/refresh")
async def refresh_rss_feeds(request: RssFeedRefreshRequest):
    """Refresh RSS feeds."""
    try:
        result = await refresh_feeds(request.feed_id)
        if isinstance(result, str):
            return {"message": result}

        if request.feed_id:
            return {
                "message": f"Feed with id {request.feed_id} refreshed successfully"
            }
        else:
            return {"message": f"{result} feeds refreshed successfully"}
    except Exception as e:
        logger.error(f"Error refreshing feeds: {e}")
        raise HTTPException(status_code=500, detail="Error refreshing feeds")


@router.get("/analysis/latest")
async def get_analysis():
    """Fetch the latest daily analysis."""
    analysis = get_latest_analysis()
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis available")

    return {
        **analysis,
        "is_processing": refresh_manager.is_task_running("analysis"),
    }


@router.post("/analysis/generate")
async def trigger_analysis(background_tasks: BackgroundTasks):
    """Manually trigger a new analysis."""
    if refresh_manager.is_task_running("analysis"):
        return {"message": "Analysis generation already in progress"}

    async def run_analysis():
        try:
            await refresh_manager.start_refresh("analysis")
            await generate_daily_analysis(force=True)
        finally:
            await refresh_manager.end_refresh("analysis")

    background_tasks.add_task(run_analysis)
    return {"message": "Analysis generation started"}


@router.get("/server/info")
async def get_server_info():
    """Get server information including running models (when available)."""
    try:
        client = get_llm_client()
        process_info = await client.ps()
        return process_info
    except Exception as e:
        logger.error(f"Error getting server info: {e}")
        raise HTTPException(
            status_code=500, detail="Error fetching server information"
        )
