"""Database schema migrations for Phlox.

This module handles all database schema version migrations. Migrations are
implemented as pure functions that accept cursor and db parameters to avoid
circular imports with the connection module.
"""

import json
import logging

from server.database.config.defaults.letters import DefaultLetters
from server.database.config.defaults.prompts import DEFAULT_PROMPTS
from server.database.config.defaults.templates import DefaultTemplates

SCHEMA_VERSION = 4


def run_migrations(patient_db):
    """Handle database schema updates.

    Args:
        patient_db: PatientDatabase instance with cursor and db attributes
    """
    cursor = patient_db.cursor
    db = patient_db.db

    try:
        # Create version table if it doesn't exist
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY
            )
        """
        )

        # Get current version (be tolerant if table is empty)
        cursor.execute("SELECT MAX(version) AS version FROM schema_version")
        result = cursor.fetchone()
        current_version = (result["version"] if result else None) or 0

        if current_version < SCHEMA_VERSION:
            logging.info(
                f"Updating database from version {current_version + 1} to {SCHEMA_VERSION}"
            )

            # Run all necessary migrations in order
            for version in range(current_version + 1, SCHEMA_VERSION + 1):
                migration_func = globals().get(f"migrate_to_v{version}")
                if not migration_func:
                    raise RuntimeError(
                        f"Missing migration function: migrate_to_v{version}"
                    )

                logging.info(f"Running migration to version {version}")
                print(f"Running migration to version {version}")
                migration_func(cursor, db)

            # Update schema version
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


def migrate_to_v1(cursor, db):
    """Initial schema setup."""
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            dob TEXT,
            ur_number TEXT,
            gender TEXT,
            encounter_date TEXT,
            template_key TEXT,
            template_data JSON,
            raw_transcription TEXT,
            transcription_duration REAL,
            process_duration REAL,
            primary_condition TEXT,
            final_letter TEXT,
            encounter_summary TEXT,
            jobs_list JSON,
            all_jobs_completed BOOLEAN,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Templates table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS clinical_templates (
            template_key TEXT PRIMARY KEY,
            template_name TEXT NOT NULL,
            fields JSON NOT NULL,
            deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Create indexes
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_encounter_date ON patients (encounter_date)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_ur_number ON patients (ur_number)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_template_key ON patients (template_key)"
    )

    # Dashboard tables
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS rss_feeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL UNIQUE,
            title TEXT,
            last_refreshed TEXT
        )
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task TEXT NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT 0
        )
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS rss_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feed_id INTEGER,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            description TEXT,
            published TEXT,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            digest TEXT,
            FOREIGN KEY (feed_id) REFERENCES rss_feeds (id)
        )
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS combined_digests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            digest TEXT NOT NULL,
            articles_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """
    )

    # Configuration tables
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS prompts (
            key TEXT PRIMARY KEY,
            system TEXT
        )
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS options (
            category TEXT,
            key TEXT,
            value TEXT,
            PRIMARY KEY (category, key)
        )
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            specialty TEXT,
            default_template_key TEXT,
            default_letter_template_id INTEGER,
            quick_chat_1_title TEXT DEFAULT 'Critique my plan',
            quick_chat_1_prompt TEXT DEFAULT 'Critique my plan',
            quick_chat_2_title TEXT DEFAULT 'Any additional investigations',
            quick_chat_2_prompt TEXT DEFAULT 'Any additional investigations',
            quick_chat_3_title TEXT DEFAULT 'Any differentials to consider',
            quick_chat_3_prompt TEXT DEFAULT 'Any differentials to consider'
        )
    """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS letter_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            instructions TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    prompts_data = DEFAULT_PROMPTS

    # Initialize config with default entries
    default_config = {
        "WHISPER_BASE_URL": "&nbsp;",
        "WHISPER_MODEL": "&nbsp;",
        "WHISPER_KEY": "&nbsp;",
        "OLLAMA_BASE_URL": "&nbsp;",
        "PRIMARY_MODEL": "&nbsp;",
        "SECONDARY_MODEL": "&nbsp;",
        "EMBEDDING_MODEL": "&nbsp;",
        "DAILY_SUMMARY": "&nbsp;",
    }

    for key, value in default_config.items():
        cursor.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
            (key, json.dumps(value)),
        )
    for key, prompt in prompts_data["prompts"].items():
        if key != "reasoning":  # Skip reasoning prompt for v1
            cursor.execute(
                """
                INSERT OR REPLACE INTO prompts
                (key, system)
                VALUES (?, ?)
                """,
                (key, prompt.get("system", "")),
            )

    default_options = prompts_data["options"].get("general", {})
    for category, options in prompts_data["options"].items():
        if category != "reasoning":
            for key, value in options.items():
                actual_value = options.get(key, default_options.get(key))
                if actual_value is not None:
                    cursor.execute(
                        "INSERT OR REPLACE INTO options (category, key, value) VALUES (?, ?, ?)",
                        (category, key, json.dumps(actual_value)),
                    )

    letter_templates = DefaultLetters.get_default_letter_templates()
    for letter_template in letter_templates:
        cursor.execute(
            """
            INSERT INTO letter_templates (id, name, instructions, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        """,
            letter_template,
        )


def migrate_to_v2(cursor, db):
    """Add reasoning analysis support."""
    try:
        # Add reasoning_output column to patients table
        cursor.execute(
            """
            ALTER TABLE patients
            ADD COLUMN reasoning_output JSON
            """
        )

        # Add index for encounter_date to optimize nightly processing
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_reasoning_date
            ON patients(encounter_date, reasoning_output)
            """
        )

        # Add configuration for reasoning model and toggle
        cursor.execute(
            """
            INSERT OR IGNORE INTO config (key, value)
            VALUES
                ('REASONING_MODEL', ?),
                ('REASONING_ENABLED', ?)
        """,
            (json.dumps("&nbsp;"), json.dumps(False)),
        )

        defaults = DEFAULT_PROMPTS

        # Add new reasoning prompt
        reasoning_prompt = defaults["prompts"]["reasoning"]["system"]
        cursor.execute(
            """
            INSERT OR IGNORE INTO prompts (key, system)
            VALUES (?, ?)
        """,
            ("reasoning", reasoning_prompt),
        )

        # Add reasoning options
        reasoning_options = defaults["options"]["reasoning"]
        for key, value in reasoning_options.items():
            cursor.execute(
                """
                INSERT OR IGNORE INTO options (category, key, value)
                VALUES (?, ?, ?)
            """,
                ("reasoning", key, str(value)),
            )

        db.commit()
        logging.info("Successfully migrated to schema version 2")

    except Exception as e:
        logging.error(f"Error during v2 migration: {e}")
        db.rollback()
        raise


def migrate_to_v3(cursor, db):
    """Migrate configuration from Ollama-based setup to OpenAI-compatible setup and update template schema."""
    try:
        # Part 1: Handle configuration migration
        # Get existing configuration values
        cursor.execute("SELECT key, value FROM config")
        existing_config = {}
        for row in cursor.fetchall():
            existing_config[row["key"]] = json.loads(row["value"])

        # Determine LLM provider and base URL based on existing config
        ollama_base_url = existing_config.get("OLLAMA_BASE_URL", "&nbsp;")

        # If user has Ollama configured, migrate to new structure
        if ollama_base_url != "&nbsp;" and ollama_base_url:
            llm_provider = "ollama"
            llm_base_url = ollama_base_url
            llm_api_key = "&nbsp;"  # Ollama doesn't need API key
        else:
            # No existing Ollama setup, use defaults
            llm_provider = "ollama"
            llm_base_url = "&nbsp;"
            llm_api_key = "&nbsp;"

        # Mapping of config values to preserve/migrate
        config_mapping = {
            "WHISPER_BASE_URL": existing_config.get(
                "WHISPER_BASE_URL", "&nbsp;"
            ),
            "WHISPER_MODEL": existing_config.get("WHISPER_MODEL", "&nbsp;"),
            "WHISPER_KEY": existing_config.get("WHISPER_KEY", "&nbsp;"),
            "PRIMARY_MODEL": existing_config.get("PRIMARY_MODEL", "&nbsp;"),
            "SECONDARY_MODEL": existing_config.get("SECONDARY_MODEL", "&nbsp;"),
            "EMBEDDING_MODEL": existing_config.get("EMBEDDING_MODEL", "&nbsp;"),
            "REASONING_MODEL": existing_config.get("REASONING_MODEL", "&nbsp;"),
            "REASONING_ENABLED": existing_config.get(
                "REASONING_ENABLED", False
            ),
            # New configuration keys
            "LLM_PROVIDER": llm_provider,
            "LLM_API_KEY": llm_api_key,
            "LLM_BASE_URL": llm_base_url,
        }

        # Remove old Ollama-specific configuration
        cursor.execute("DELETE FROM config WHERE key = 'OLLAMA_BASE_URL'")

        # Update/add all configuration values
        for key, value in config_mapping.items():
            cursor.execute(
                "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
                (key, json.dumps(value)),
            )

        # Part 2: Handle template schema migration
        # Get default templates with new schema
        default_templates = DefaultTemplates.get_default_templates()
        default_fields_by_template = {}

        # Create lookup for default template fields
        for template in default_templates:
            template_key_base = template["template_key"].split("_")[
                0
            ]  # e.g., "phlox" from "phlox_01"
            default_fields_by_template[template_key_base] = {
                field["field_key"]: field for field in template["fields"]
            }

        # Get all existing templates
        cursor.execute(
            "SELECT template_key, template_name, fields FROM clinical_templates"
        )
        templates = cursor.fetchall()

        for template in templates:
            template_key = template["template_key"]
            fields = json.loads(template["fields"])
            updated_fields = []

            # Determine template type (phlox, soap, progress, or custom)
            template_base = template_key.split("_")[0]
            is_default_template = template_base in default_fields_by_template

            for field in fields:
                # Start with existing field
                updated_field = field.copy()

                # Add missing fields from new schema
                if "style_example" not in updated_field:
                    if (
                        is_default_template
                        and field["field_key"]
                        in default_fields_by_template[template_base]
                    ):
                        # Use style_example from default template
                        default_field = default_fields_by_template[
                            template_base
                        ][field["field_key"]]
                        updated_field["style_example"] = default_field.get(
                            "style_example", "&nbsp;"
                        )

                        # Also update format_schema if it's changed in defaults
                        if "format_schema" in default_field:
                            updated_field["format_schema"] = default_field[
                                "format_schema"
                            ]
                    else:
                        # Custom template, use placeholder
                        updated_field["style_example"] = "&nbsp;"

                updated_fields.append(updated_field)

            # Update the template with new fields
            cursor.execute(
                "UPDATE clinical_templates SET fields = ? WHERE template_key = ?",
                (json.dumps(updated_fields), template_key),
            )

        db.commit()
        logging.info("Successfully migrated to schema version 3")

    except Exception as e:
        logging.error(f"Error during v3 migration: {e}")
        db.rollback()
        raise


def migrate_to_v4(cursor, db):
    """Add has_completed_splash_screen and scribe_is_ambient columns to user_settings table.
    Add Dictation letter template.
    Remove 'stop' tokens from all option categories.
    """
    try:
        cursor.execute(
            "ALTER TABLE user_settings ADD COLUMN has_completed_splash_screen BOOLEAN DEFAULT TRUE"
        )
        cursor.execute(
            "ALTER TABLE user_settings ADD COLUMN scribe_is_ambient BOOLEAN DEFAULT TRUE"
        )
        cursor.execute("DELETE FROM options WHERE key = 'stop'")
        db.commit()
        logging.info("Successfully added has_completed_splash_screen column")

        # Add Dictation template
        dictation_name, dictation_instructions = (
            DefaultLetters.get_dictation_template()
        )
        cursor.execute(
            """
            INSERT INTO letter_templates (name, instructions)
            SELECT ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM letter_templates WHERE name = ?)
        """,
            (dictation_name, dictation_instructions, dictation_name),
        )

        # Update in case it already exists (during dev iteration)
        cursor.execute(
            "UPDATE letter_templates SET instructions = ? WHERE name = ?",
            (dictation_instructions, dictation_name),
        )
        db.commit()
        logging.info("Successfully added Dictation template")

    except Exception as e:
        logging.error(f"Error during v4 migration: {e}")
        db.rollback()
        raise
