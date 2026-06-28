"""
Shared connection factory for the documents SQLite database.
"""

import logging
import sqlite3
import threading
from pathlib import Path

from server.constants import DATA_DIR

logger = logging.getLogger(__name__)

DOCUMENTS_DB_PATH: Path = DATA_DIR / "documents.sqlite"

# Module-level singleton for the simple (non-vector) connection used by
# PDFFormStore and other lightweight consumers.
_simple_connection: sqlite3.Connection | None = None
_simple_lock = threading.Lock()


def get_documents_connection() -> sqlite3.Connection:
    """Return a long-lived sqlite3 connection to ``documents.sqlite``.

    Callers should **not** close this connection — it is reused across calls.
    """
    global _simple_connection
    if _simple_connection is None:
        with _simple_lock:
            if _simple_connection is None:
                DOCUMENTS_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
                conn = sqlite3.connect(
                    str(DOCUMENTS_DB_PATH),
                    check_same_thread=False,
                )
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute("PRAGMA foreign_keys=ON")
                conn.execute("PRAGMA busy_timeout=30000")
                _simple_connection = conn
                logger.info("Opened documents.sqlite connection at %s", DOCUMENTS_DB_PATH)
    return _simple_connection
