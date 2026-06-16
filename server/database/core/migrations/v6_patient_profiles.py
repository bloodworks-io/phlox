"""Migration v6: patient_profiles table + job_extraction prompt seed."""

from server.database.config.defaults.prompts import DEFAULT_PROMPTS


def _split_name(name):
    """Split a legacy display name into (first_name, last_name).

    Handles "Last, First", "First Last", and bare names.
    """
    if not name:
        return "", ""
    name = name.strip()
    if ", " in name:
        last, first = name.split(", ", 1)
        return first.strip(), last.strip()
    if " " in name:
        first, last = name.rsplit(" ", 1)
        return first.strip(), last.strip()
    return "", name


def migrate(cursor, _db):
    """Add patient_profiles (source-of-truth per-person demographics) and seed
    the job_extraction prompt.

    patient_profiles holds stable demographics keyed by ur_number.
    """
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS patient_profiles (
            ur_number TEXT PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            dob TEXT,
            gender TEXT,
            address TEXT,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        SELECT name, dob, gender, ur_number
        FROM patients
        WHERE ur_number IS NOT NULL AND ur_number != ''
          AND id = (
              SELECT MAX(id) FROM patients p2
              WHERE p2.ur_number = patients.ur_number
          )
        """
    )
    for row in cursor.fetchall():
        first_name, last_name = _split_name(row["name"])
        cursor.execute(
            """
            INSERT OR IGNORE INTO patient_profiles
                (ur_number, first_name, last_name, dob, gender, address, phone)
            VALUES (?, ?, ?, ?, ?, NULL, NULL)
            """,
            (row["ur_number"], first_name, last_name, row["dob"], row["gender"]),
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
