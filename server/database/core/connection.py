"""Database connection management for Phlox.

This module provides the core database connection functionality using
SQLCipher for encrypted SQLite storage. The PatientDatabase class
implements a singleton pattern to ensure only one database connection
exists throughout the application lifecycle.

Transactions belong to the connection, not to individual cursors, so a
shared cursor is unsafe: one caller can commit/roll back another caller's
pending work and clobber ``lastrowid``/``rowcount``. We therefore expose
only two locked context managers — ``transaction()`` (writes) and
``read()`` (reads) — each of which hands out a short-lived local cursor
while holding one connection-level ``RLock``.

For desktop mode, use initialize_database(passphrase) to defer
initialization until the user provides their password.
For Docker mode, initialize_database() will use env/secret.
"""

import logging
import os
import threading
from contextlib import contextmanager
from pathlib import Path

import sqlcipher3 as sqlite3
from server.constants import DATA_DIR
from server.database.core.backup import create_backup
from server.database.core.initialization import (
    initialize_templates,
    set_initial_default_template,
)
from server.database.core.migrations import run_migrations

# Module-level state for lazy initialization
_db_instance = None
_db_lock = threading.Lock()


def is_db_initialized() -> bool:
    """Check if the database has been initialized."""
    return _db_instance is not None


def get_db() -> "PatientDatabase":
    """Get the database singleton. Raises error if not initialized."""
    if _db_instance is None:
        raise RuntimeError("Database not initialized. Call initialize_database() first.")
    return _db_instance


def initialize_database(passphrase: str | None = None, db_dir=DATA_DIR) -> "PatientDatabase":
    """Initialize the database singleton with optional passphrase.

    Args:
        passphrase: Encryption key for desktop mode. If None, uses env/secret.
        db_dir: Directory path for database files

    Returns:
        The database singleton instance
    """
    global _db_instance

    with _db_lock:
        if _db_instance is not None:
            return _db_instance

        _db_instance = PatientDatabase(passphrase=passphrase, db_dir=db_dir)
        return _db_instance


class PatientDatabase:
    """Database connection manager for Phlox.

    This class manages an encrypted SQLite database connection using
    SQLCipher and handles migrations on initialization.

    Use initialize_database() to create instances.
    """

    def __init__(self, passphrase: str | None = None, db_dir=DATA_DIR):
        """Initialize the database connection.

        Args:
            passphrase: Encryption key. If None, uses env/secret.
            db_dir: Directory path for database files
        """

        self._lock = threading.RLock()

        self.db_dir = db_dir
        self.encryption_key = passphrase

        # Set up database name and path first (needed for error handling)
        self.is_test = os.environ.get("TESTING", "False").lower() == "true"
        self.db_name = "test_phlox_database.sqlite" if self.is_test else "phlox_database.sqlite"
        self.db_path = str(Path(self.db_dir) / self.db_name)

        # If passphrase not provided, try env/secret sources
        if not self.encryption_key:
            # Try Podman secret file (for Docker deployments)
            secret_file = "/run/secrets/db_encryption_key"  # nosec B105
            if Path(secret_file).exists():
                try:
                    with Path(secret_file).open() as f:
                        self.encryption_key = f.read().strip()
                    logging.info("Using encryption key from Podman secret")
                except Exception as e:
                    logging.warning(f"Failed to read secret file: {e}")

        if not self.encryption_key:
            # Fallback to environment variable (for dev/testing)
            self.encryption_key = os.environ.get("DB_ENCRYPTION_KEY")
            if self.encryption_key:
                logging.info("Using encryption key from environment variable")

        if not self.encryption_key:
            # Check if this is a first-run scenario
            if not Path(self.db_path).exists():
                # New database - this is acceptable if key will be provided
                logging.warning(
                    "No encryption key provided for new database. "
                    "Encryption setup must be completed via the desktop app."
                )
                raise ValueError(
                    "Database encryption key not configured. "
                    "Please complete the encryption setup process in the Phlox app."
                )
            else:
                # Existing database without key - data loss scenario
                logging.error(
                    "Existing database found but no encryption key was provided. "
                    "The database cannot be decrypted without the correct key."
                )
                raise ValueError(
                    "Cannot decrypt existing database. "
                    "Please provide the correct encryption passphrase in the Phlox app. "
                    "If you have forgotten your passphrase, your data cannot be recovered."
                )
        self.ensure_data_directory()
        # Create backup before any database operations/migrations
        create_backup(self.db_path, Path(self.db_dir))
        self.connect_to_database()
        run_migrations(self)  # Run migrations first to create tables
        self.ensure_default_templates()  # Then ensure default templates
        self.set_initial_default_template()  # Set phlox as default template

    def ensure_data_directory(self):
        """Ensure the data directory exists."""
        if not Path(self.db_dir).exists():
            logging.info(
                "Data directory does not exist. Creating data directory at %s",
                self.db_dir,
            )
            Path(self.db_dir).mkdir(parents=True, exist_ok=True)
        else:
            logging.info("Data directory exists.")
        logging.info(f"Database path: {self.db_path}")

    def connect_to_database(self):
        """Establish encrypted database connection."""
        try:
            db_exists = Path(self.db_path).exists()
            self.db = sqlite3.connect(self.db_path, check_same_thread=False)
            self.db.row_factory = sqlite3.Row

            assert self.encryption_key is not None  # nosec B101
            escaped_key = self.encryption_key.replace("'", "''")
            pragma = f"PRAGMA key='{escaped_key}'"

            # Keying must happen on the raw connection before any locked
            # context is used; PRAGMAs are not transactional anyway.
            setup_cursor = self.db.cursor()
            try:
                # Set busy timeout to prevent "database is locked" errors (30 seconds)
                setup_cursor.execute("PRAGMA busy_timeout = 30000")

                if db_exists:
                    logging.info("Database exists, attempting to decrypt...")
                    try:
                        setup_cursor.execute(pragma)
                        logging.info("Database decrypted successfully")
                        setup_cursor.execute("SELECT count(*) FROM sqlite_master")
                    except sqlite3.DatabaseError:
                        logging.error("Failed to decrypt existing database. Wrong encryption key?")
                        raise ValueError("Cannot decrypt database - wrong key?") from None
                else:
                    # New database - set up encryption
                    logging.info("No existing database, creating new database...")
                    setup_cursor.execute(pragma)
                self.db.commit()
            finally:
                setup_cursor.close()

            logging.info("Database connection established successfully")
        except Exception as e:
            logging.error(f"Failed to connect to database: {str(e)}")
            raise

    @contextmanager
    def transaction(self):
        """Locked write transaction.

        Yields a short-lived local cursor. Commits on clean exit, rolls back
        on any abnormal exit. Nested writes are rejected because transactions
        belong to the connection and an inner commit would commit outer work.
        """
        with self._lock:
            if self.db.in_transaction:
                raise RuntimeError("Nested database transactions are not supported")

            cursor = self.db.cursor()
            try:
                # Reserve the write lock now so read-modify-write operations
                # remain atomic across other SQLite connections too.
                cursor.execute("BEGIN IMMEDIATE")
                yield cursor
                self.db.commit()
            except BaseException:
                self.db.rollback()
                raise
            finally:
                cursor.close()

    @contextmanager
    def read(self):
        """Locked read-only access via a short-lived local cursor.

        No commit is issued. Reentrant under ``_lock`` so reads nested inside
        a ``transaction()`` (e.g. template lookups while building history)
        see the pending writes of the same connection without deadlocking.
        """
        with self._lock:
            cursor = self.db.cursor()
            try:
                yield cursor
            finally:
                cursor.close()

    def ensure_default_templates(self):
        """Ensure all default templates exist."""
        try:
            with self.transaction() as cursor:
                initialize_templates(cursor, self.db)
        except Exception as e:
            logging.error(f"Error initializing templates: {e}")
            raise

    def set_initial_default_template(self):
        """Set the initial default template to the latest Phlox template."""
        try:
            with self.transaction() as cursor:
                set_initial_default_template(cursor, self.db)
        except Exception as e:
            logging.error(f"Error setting initial default template: {e}")
            raise

    def close(self):
        """Close database connection."""
        try:
            self.db.close()
        except Exception as e:
            logging.error(f"Error closing database connection: {str(e)}")

    def clear_test_database(self):
        """Clear all test data from database."""
        from server.database.testing import clear_test_database as _clear

        _clear(self)

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
