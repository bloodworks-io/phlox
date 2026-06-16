"""
Migration runner with savepoint-based transaction handling.
"""

import logging

SCHEMA_VERSION = 6


def run_migrations(patient_db):
    """Run all pending schema migrations.

    Uses SAVEPOINT so each migration can be rolled back individually
    without discarding the work of prior migrations that already committed.

    Args:
        patient_db: PatientDatabase instance with cursor and db attributes
    """
    from server.database.core.migrations import MIGRATIONS

    cursor = patient_db.cursor
    db = patient_db.db

    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY
            )
        """
        )

        cursor.execute("SELECT MAX(version) AS version FROM schema_version")
        result = cursor.fetchone()
        current_version = (result["version"] if result else None) or 0

        if current_version < SCHEMA_VERSION:
            logging.info(
                f"Updating database from version {current_version + 1} to {SCHEMA_VERSION}"
            )

            for version in range(current_version + 1, SCHEMA_VERSION + 1):
                migration_func = MIGRATIONS.get(version)
                if not migration_func:
                    raise RuntimeError(f"Missing migration: v{version}")

                logging.info(f"Running migration to version {version}")
                print(f"Running migration to version {version}")

                cursor.execute(f"SAVEPOINT v{version}")
                try:
                    migration_func(cursor, db)
                except Exception:
                    cursor.execute(f"ROLLBACK TO SAVEPOINT v{version}")
                    raise

            cursor.execute("DELETE FROM schema_version")
            cursor.execute(
                "INSERT INTO schema_version (version) VALUES (?)",
                (SCHEMA_VERSION,),
            )
            db.commit()

        logging.info(f"Database schema is at version {SCHEMA_VERSION}")

    except Exception as e:
        logging.error(f"Migration failed: {str(e)}")
        db.rollback()
        raise
