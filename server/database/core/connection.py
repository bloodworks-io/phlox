"""Database connection management for Phlox.

This module provides the core database connection functionality using
SQLCipher for encrypted SQLite storage. The PatientDatabase class
implements a singleton pattern to ensure only one database connection
exists throughout the application lifecycle.
"""

import logging
import os
import threading

import sqlcipher3 as sqlite3
from server.constants import DATA_DIR
from server.database.core.initialization import (
    initialize_templates,
    set_initial_default_template,
)
from server.database.core.migrations import run_migrations
from server.database.testing import clear_test_database, run_database_test


class PatientDatabase:
    """Singleton database connection manager for Phlox.

    This class manages an encrypted SQLite database connection using
    SQLCipher, handles migrations on initialization, and provides
    a singleton instance for use throughout the application.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls, db_dir=None):
        """Implement singleton pattern with thread safety."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(PatientDatabase, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def connect_to_database(self):
        """Establish encrypted database connection."""
        try:
            db_exists = os.path.exists(self.db_path)
            self.db = sqlite3.connect(self.db_path, check_same_thread=False)
            self.db.row_factory = sqlite3.Row
            self.cursor = self.db.cursor()

            if db_exists:
                logging.info("Database exists, attempting to decrypt...")
                try:
                    self.cursor.execute(f"PRAGMA key='{self.encryption_key}'")
                    logging.info("Database decrypted successfully")
                    self.cursor.execute("SELECT count(*) FROM sqlite_master")
                except sqlite3.DatabaseError:
                    logging.error(
                        "Failed to decrypt existing database. Wrong encryption key?"
                    )
                    raise ValueError("Cannot decrypt database - wrong key?")
            else:
                # New database - set up encryption
                logging.info("No existing database, creating new database...")
                self.cursor.execute(f"PRAGMA key='{self.encryption_key}'")

            logging.info("Database connection established successfully")
        except Exception as e:
            logging.error(f"Failed to connect to database: {str(e)}")
            raise

    def ensure_data_directory(self):
        """Ensure the data directory exists."""
        if not os.path.exists(self.db_dir):
            logging.info(
                "Data directory does not exist. Creating data directory at %s",
                self.db_dir,
            )
            os.makedirs(self.db_dir, exist_ok=True)
        else:
            logging.info("Data directory exists.")
        logging.info(f"Database path: {self.db_path}")

    def ensure_default_templates(self):
        """Ensure all default templates exist."""
        try:
            initialize_templates(self.cursor, self.db)
            self.db.commit()
        except Exception as e:
            logging.error(f"Error initializing templates: {e}")
            raise

    def __init__(self, db_dir=DATA_DIR):
        """Initialize the database connection.

        Args:
            db_dir: Directory path for database files
        """
        self.db_dir = db_dir
        self.encryption_key = None

        # Try Podman secret file first
        secret_file = "/run/secrets/db_encryption_key"
        if os.path.exists(secret_file):
            try:
                with open(secret_file, "r") as f:
                    self.encryption_key = f.read().strip()
                logging.info("Using encryption key from Podman secret")
            except Exception as e:
                logging.warning(f"Failed to read secret file: {e}")

        # Fallback to environment variable
        if not self.encryption_key:
            self.encryption_key = os.environ.get("DB_ENCRYPTION_KEY")
            if self.encryption_key:
                logging.info("Using encryption key from environment variable")

        if not self.encryption_key:
            # Check if this is a first-run scenario
            db_path = os.path.join(self.db_dir, self.db_name)
            if not os.path.exists(db_path):
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

        self.is_test = os.environ.get("TESTING", "False").lower() == "true"
        self.db_name = (
            "test_phlox_database.sqlite"
            if self.is_test
            else "phlox_database.sqlite"
        )
        self.db_path = os.path.join(self.db_dir, self.db_name)
        self.ensure_data_directory()
        self.connect_to_database()
        run_migrations(self)  # Run migrations first to create tables
        self.ensure_default_templates()  # Then ensure default templates
        set_initial_default_template(
            self.cursor, self.db
        )  # Set phlox as default template

        self._initialized = True  # Mark as initialized

    def test_database(self):
        """Test database functionality with sample data.

        Returns:
            True if test successful
        """
        return run_database_test(self.cursor, self.db)

    def commit(self):
        """Commit current transaction."""
        self.db.commit()

    def close(self):
        """Close database connection."""
        try:
            self.db.close()
        except Exception as e:
            logging.error(f"Error closing database connection: {str(e)}")

    def clear_test_database(self):
        """Clear all test data from database."""
        clear_test_database(self.db, self.cursor, self.is_test)

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()


# Global singleton instance
db = PatientDatabase()
