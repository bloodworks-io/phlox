"""Migration v6: patient_profiles table"""

from server.database.config.defaults.prompts import DEFAULT_PROMPTS


def migrate(cursor, _db):
    """Add patient_profiles table and seed the job_extraction prompt.

    patient_profiles holds stable per-person demographics keyed by ur_number.

    The job_extraction prompt backs the Wrap Up flow.
    """
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS patient_profiles (
            ur_number TEXT PRIMARY KEY,
            address TEXT,
            phone TEXT,
            medicare_no TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        INSERT OR IGNORE INTO prompts (key, system)
        VALUES (?, ?)
        """,
        (
            "job_extraction",
            DEFAULT_PROMPTS["prompts"]["job_extraction"]["system"],
        ),
    )
