if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()

import logging
import os
import secrets
import socket
import sys
from contextlib import asynccontextmanager, closing

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from server.constants import (
    APP_NAME,
    BUILD_DIR,
    IS_DOCKER,
    IS_TESTING,
    PROXY_AUTH_ENABLED,
    PROXY_AUTH_USER_HEADER,
    RATE_LIMIT_ENABLED,
)
from server.middleware import (
    LocalTokenMiddleware,
    ProxyAuthMiddleware,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    TrustedProxyMiddleware,
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

# Local request token for API authentication (desktop mode only)
from server.utils.local_request_token import get_request_token, set_request_token

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
    from server.middleware import RateLimitMiddleware

    # Startup
    scheduler.start()
    # Schedule jobs
    scheduler.add_job(generate_daily_analysis, "cron", hour=3)
    scheduler.add_job(run_nightly_reasoning, "cron", hour=4)
    # Clean up zombie IPs from rate limiter every 5 minutes
    scheduler.add_job(
        RateLimitMiddleware.cleanup_all_zombie_ips,
        "interval",
        minutes=5,
    )

    yield

    # Shutdown
    scheduler.shutdown()


def initialize_and_get_app():
    """Initialize database and return the FastAPI app.

    This is called after passphrase is available (desktop) or immediately (docker).
    """
    # Initialize config_manager and run migrations
    logger.info("Initializing DB and running migrations...")

    logger.info("Database initialized")

    app = FastAPI(
        title=APP_NAME,
        lifespan=lifespan,  # Add the lifespan context manager
    )

    # CORS configuration - restrict via environment variable
    # Note: Browsers reject allow_credentials=True with allow_origins=["*"]
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    allowed_origins = [origin.strip() for origin in allowed_origins]

    if "*" in allowed_origins:
        # Wildcard mode - no credentials allowed by browsers
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        # Specific origins - credentials allowed
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Add security middleware (order matters: last added runs first)
    # So we add in reverse order: Token -> Proxy -> RateLimit -> TrustedProxy -> Security
    # This ensures TrustedProxy sets client_ip before RateLimit needs it

    # Add token verification middleware (only for desktop mode)
    if not IS_DOCKER:
        app.add_middleware(LocalTokenMiddleware)

    # Add proxy auth middleware (for Docker deployments behind auth proxy)
    if PROXY_AUTH_ENABLED:
        app.add_middleware(ProxyAuthMiddleware)
        logger.info(f"Proxy auth enabled, header: {PROXY_AUTH_USER_HEADER}")

    # Add rate limiting middleware (enabled by default in Docker mode)
    if RATE_LIMIT_ENABLED:
        app.add_middleware(RateLimitMiddleware)
        logger.info("Rate limiting enabled")

    # TrustedProxy must be added after RateLimit so it runs BEFORE RateLimit
    app.add_middleware(TrustedProxyMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

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
                raise HTTPException(status_code=500, detail=f"Database test failed: {str(e)}")

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
        logger.warning("RAG/Chat features disabled - dependencies not available.")

    app.include_router(config_router, prefix="/api/config")
    app.include_router(templates.router, prefix="/api/templates")
    app.include_router(letter.router, prefix="/api/letter")

    # React app routes
    @app.get("/new-patient")
    @app.get("/settings")
    @app.get("/rag")
    @app.get("/clinic-summary")
    @app.get("/outstanding-tasks")
    @app.get("/patient/{patient_id}")
    async def serve_react_app():
        return FileResponse(BUILD_DIR / "index.html")

    # Serve static files
    app.mount("/", StaticFiles(directory=BUILD_DIR, html=True), name="static")

    # Catch-all route for any other paths
    @app.get("/{full_path:path}")
    async def catch_all(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
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

    # Generate cryptographically secure request token
    token = secrets.token_hex(32)  # 64 character hex string (256 bits)
    set_request_token(token)
    logger.info(token)

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

    # Write ports and token to stdout so process manager can read them
    print(
        f"PORTS:{server_port},{llama_port},{whisper_port}|TOKEN:{get_request_token()}",
        flush=True,
    )

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
            host=os.getenv("SERVER_HOST", "0.0.0.0"),
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
