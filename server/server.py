if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()

import logging
import os
import socket
import sys
from contextlib import asynccontextmanager, closing
from pathlib import Path

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from server.constants import (
    APP_NAME,
    BUILD_DIR,
    DATA_DIR,
    IS_DOCKER,
    IS_TESTING,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
    force=True,
)

# Silence noisy libraries
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("apscheduler").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)
logger.info("Initialising application...")
scheduler = AsyncIOScheduler()


if IS_TESTING:
    try:
        from server.tests.test_database import test_db as test_database
    except ImportError:
        test_database = None
else:
    test_database = None


# Start the scheduler when the app starts
@asynccontextmanager
async def lifespan(app: FastAPI):
    from server.database.entities.analysis import (
        generate_daily_analysis,
        run_nightly_reasoning,
    )

    # Startup
    scheduler.start()
    # Schedule jobs
    scheduler.add_job(generate_daily_analysis, "cron", hour=3)
    scheduler.add_job(run_nightly_reasoning, "cron", hour=4)

    yield

    # Shutdown
    scheduler.shutdown()


def initialize_and_get_app():
    """Initialize database and return the FastAPI app.

    This is called after passphrase is available (desktop) or immediately (docker).
    """
    # Initialize config_manager and run migrations
    logger.info("Initializing DB and running migrations...")
    from server.database.config.manager import config_manager

    logger.info("Database initialized")

    app = FastAPI(
        title=APP_NAME,
        lifespan=lifespan,  # Add the lifespan context manager
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Then load API submodules
    from server.api import (
        dashboard,
        letter,
        patient,
        templates,
        transcribe,
    )
    from server.api.config import router as config_router

    from server.utils.rag.chroma import CHROMADB_AVAILABLE

    # Only create test endpoint in testing environment
    if IS_TESTING and test_database is not None:

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

    # Conditionally include RAG routers if dependencies are available
    if CHROMADB_AVAILABLE:
        from server.api import (
            chat,
            rag,
        )

        app.include_router(rag.router, prefix="/api/rag")
        app.include_router(chat.router, prefix="/api/chat")
    else:
        logger.warning(
            "RAG/Chat features disabled - dependencies not available."
        )

    app.include_router(config_router, prefix="/api/config")
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

    return app


# For Docker mode, initialize app at module load (backward compatibility)
if IS_DOCKER:
    from server.database.core.connection import initialize_database

    initialize_database()  # Uses env/secret
    app = initialize_and_get_app()
else:
    # Desktop mode: app will be initialized after passphrase is received
    app = None


def find_free_port():
    """Find a free port on the local machine"""
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(("", 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port


def start_server_for_desktop():
    """Start server with dynamic port for desktop app.

    Waits for passphrase from stdin before initializing database.
    """
    global app
    logger.info("Desktop environment detected")

    # Signal that we're waiting for passphrase
    print("WAITING_FOR_PASSPHRASE", flush=True)

    # Block waiting for passphrase from stdin
    passphrase = sys.stdin.readline().strip()

    if not passphrase:
        logger.error("No passphrase received from stdin")
        sys.exit(1)

    # Initialize database with passphrase
    from server.database.core.connection import initialize_database

    try:
        initialize_database(passphrase=passphrase)
    except ValueError as e:
        logger.error(f"Failed to initialize database: {e}")
        print(f"ERROR:{e}", flush=True)
        sys.exit(1)

    # Now initialize the app
    app = initialize_and_get_app()

    # Find 3 ports - one for each service
    server_port = find_free_port()
    llama_port = find_free_port()
    whisper_port = find_free_port()

    # Store in global state for other modules to access
    from server.utils.allocated_ports import set_ports

    set_ports(server_port, llama_port, whisper_port)

    # Write all ports to stdout so process manager can read them
    print(f"PORTS:{server_port},{llama_port},{whisper_port}", flush=True)

    config = uvicorn.Config(
        app,
        host="127.0.0.1",  # Only localhost
        port=server_port,
        timeout_keep_alive=300,
        timeout_graceful_shutdown=10,
        loop="asyncio",
        workers=0,
        http="httptools",
    )
    server = uvicorn.Server(config)
    server.run()


if __name__ == "__main__":
    if not IS_DOCKER:
        # Desktop mode - dynamic port, single worker
        start_server_for_desktop()
    else:
        # Docker mode
        config = uvicorn.Config(
            app,
            host=os.getenv("SERVER_HOST", "127.0.0.1"),
            port=int(os.getenv("PORT", 5000)),
            timeout_keep_alive=300,
            timeout_graceful_shutdown=10,
            loop="asyncio",
            workers=1,
            http="httptools",
            ws_ping_interval=None,
            ws_ping_timeout=None,
        )
        server = uvicorn.Server(config)
        server.run()
