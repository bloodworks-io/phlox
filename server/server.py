import logging
import os
import json
from pathlib import Path
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from server.api import chat, config, dashboard, patient, rag, transcribe, templates, letter
from server.database.config import ConfigManager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from server.database.analysis import generate_daily_analysis, run_nightly_reasoning

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_version():
    with open('/usr/src/app/package.json') as f:
        package_data = json.load(f)
        return package_data.get('version', '0.0.0')

app = FastAPI(
    title="Phlox",
    version=get_version()
)

scheduler = AsyncIOScheduler()


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
DATA_DIR = Path("/usr/src/app/data")
BUILD_DIR = Path("/usr/src/app/build")
IS_TESTING = os.getenv("TESTING", "false").lower() == "true"


# Schedule daily analysis
scheduler.add_job(generate_daily_analysis, "cron", hour=3)

# Schedule reasoning analysis
scheduler.add_job(run_nightly_reasoning, "cron", hour=4)

# Start the scheduler when the app starts
@app.on_event("startup")
async def startup_event():
    scheduler.start()
    # Run analysis if none exists or if last one is old
    await generate_daily_analysis()


@app.get("/test-db")
async def test_db():
    try:
        result = test_database()
        logger.info(f"Database test succeeded: {result}")
        return {"success": "Database test succeeded", "result": result}
    except Exception as e:
        logger.error(f"Database test failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Database test failed: {str(e)}"
        )


# Include routers
app.include_router(patient.router, prefix="/api/patient")
app.include_router(transcribe.router, prefix="/api/transcribe")
app.include_router(dashboard.router, prefix="/api/dashboard")
app.include_router(rag.router, prefix="/api/rag")
app.include_router(config.router, prefix="/api/config")
app.include_router(chat.router, prefix="/api/chat")
app.include_router(templates.router, prefix="/api/templates")
app.include_router(letter.router, prefix="/api/letter")

# React app routes
@app.get("/new-patient")
@app.get("/settings")
@app.get("/rag")
@app.get("/clinic-summary")
@app.get("/outstanding-tasks")
async def serve_react_app():
    return FileResponse(BUILD_DIR / "index.html")


# Serve static files
app.mount("/", StaticFiles(directory=BUILD_DIR, html=True), name="static")


# Catch-all route for any other paths
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    return FileResponse(BUILD_DIR / "index.html")


if __name__ == "__main__":
    config = uvicorn.Config(
        "server.server:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        timeout_keep_alive=300,
        timeout_graceful_shutdown=10,
        loop="asyncio",
        workers=1,
        http="httptools",
        loop_wait=0.0,
        ws_ping_interval=None,
        ws_ping_timeout=None,
        buffer_size=0
    )
    server = uvicorn.Server(config)
    server.run()
