import os
import sqlcipher3 as sqlite3
import json
import threading
import logging
from pathlib import Path
from server.constants import DATA_DIR
from datetime import datetime
from server.schemas.templates import ClinicalTemplate, TemplateField
from server.database.defaults.templates import DefaultTemplates
from server.database.defaults.letters import DefaultLetters


class PatientDatabase:
    SCHEMA_VERSION = 3  # Current schema version
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, db_dir=None):
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
                try:
                    self.cursor.execute(f"PRAGMA key='{self.encryption_key}'")
                    self.cursor.execute("SELECT count(*) FROM sqlite_master")
                except sqlite3.DatabaseError:
                    logging.error(
                        "Failed to decrypt existing database. Wrong encryption key?"
                    )
                    raise ValueError("Cannot decrypt database - wrong key?")
            else:
                # New database - set up encryption
                logging.info("Creating new database...")
                self.cursor.execute(f"PRAGMA key='{self.encryption_key}'")

            logging.info("Database connection established successfully")
        except Exception as e:
            logging.error(f"Failed to connect to database: {str(e)}")
            raise

    def ensure_data_directory(self):
        """Ensure the data directory exists."""
        if not os.path.exists(self.db_dir):
            logging.info(
                "Data directory does not exist. Creating data directory."
            )
            os.makedirs(self.db_dir, exist_ok=True)
        else:
            logging.info("Data directory exists.")
        logging.info(f"Database path: {self.db_path}")

    def ensure_default_templates(self):
        """Ensure all default templates exist."""
        try:
            self._initialize_templates()
            self.db.commit()
        except Exception as e:
            logging.error(f"Error initializing templates: {e}")
            raise

        except Exception as e:
            logging.error(f"Error ensuring default templates: {e}")
            raise

    def _set_initial_default_template(self):
        try:
            # Get the latest non-deleted Phlox template
            self.cursor.execute(
                "SELECT template_key FROM clinical_templates WHERE template_key LIKE 'phlox%' AND (deleted IS NULL OR deleted != 1) ORDER BY created_at DESC LIMIT 1"
            )
            phlox_template = self.cursor.fetchone()

            if not phlox_template:
                logging.error("No valid Phlox template found in the database")
                return

            default_template_key = phlox_template["template_key"]

            # Check if user_settings table is empty
            self.cursor.execute("SELECT COUNT(*) FROM user_settings")
            count = self.cursor.fetchone()[0]

            if count == 0:
                # Create initial settings with default template
                self.cursor.execute(
                    "INSERT INTO user_settings (default_template_key) VALUES (?)",
                    (default_template_key,),
                )
                logging.info(
                    f"Created initial user settings with default template: {default_template_key}"
                )
            else:
                # Get current default template
                self.cursor.execute(
                    "SELECT id, default_template_key FROM user_settings LIMIT 1"
                )
                row = self.cursor.fetchone()
                current_default = row["default_template_key"]

                # Check if default template is not set or is invalid
                need_update = False

                if not current_default:
                    need_update = True
                    logging.info("No default template currently set")
                else:
                    # Verify the current default template exists and is not deleted
                    self.cursor.execute(
                        "SELECT 1 FROM clinical_templates WHERE template_key = ? AND (deleted IS NULL OR deleted != 1)",
                        (current_default,),
                    )
                    template_exists = self.cursor.fetchone() is not None

                    if not template_exists:
                        need_update = True
                        logging.info(
                            f"Current default template '{current_default}' is invalid or deleted"
                        )

                if need_update:
                    self.cursor.execute(
                        "UPDATE user_settings SET default_template_key = ? WHERE id = ?",
                        (default_template_key, row["id"]),
                    )
                    logging.info(
                        f"Updated default template to: {default_template_key}"
                    )

            self.db.commit()
        except Exception as e:
            logging.error(f"Error setting initial default template: {e}")
            raise

    def __init__(self, db_dir=None):
        # Only initialize once
        if self._initialized:
            return

        if db_dir is None:
            self.db_dir = str(DATA_DIR)
        else:
            self.db_dir = db_dir

        self.encryption_key = os.environ.get("DB_ENCRYPTION_KEY")
        if not self.encryption_key:
            logging.error("DB_ENCRYPTION_KEY environment variable not set!")
            raise ValueError("Database encryption key must be provided")

        self.is_test = os.environ.get("TESTING", "False").lower() == "true"
        self.db_name = (
            "test_phlox_database.sqlite"
            if self.is_test
            else "phlox_database.sqlite"
        )
        self.db_path = os.path.join(self.db_dir, self.db_name)
        self.ensure_data_directory()
        self.connect_to_database()
        self.run_migrations()  # Run migrations first to create tables
        self.ensure_default_templates()  # Then ensure default templates
        self._set_initial_default_template()  # Set phlox as default template

        self._initialized = True  # Mark as initialized

    def _initialize_templates(self):
        """Create default templates if they don't exist."""
        for template_data in DefaultTemplates.get_default_templates():
            if not self.template_exists(template_data["template_key"]):
                template = ClinicalTemplate(
                    template_key=template_data["template_key"],
                    template_name=template_data["template_name"],
                    fields=[
                        TemplateField(**field)
                        for field in template_data["fields"]
                    ],
                )
                now = datetime.now().isoformat()
                self.cursor.execute(
                    """
                    INSERT INTO clinical_templates (template_key, template_name, fields, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        template.template_key,
                        template.template_name,
                        json.dumps([field.dict() for field in template.fields]),
                        now,
                        now,
                    ),
                )
                logging.info(
                    f"Created default template: {template.template_name}"
                )

    def template_exists(self, template_key: str) -> bool:
        """Check if a template exists."""
        self.cursor.execute(
            "SELECT 1 FROM clinical_templates WHERE template_key = ?",
            (template_key,),
        )
        return self.cursor.fetchone() is not None

    def run_migrations(self):
        """Handle database schema updates"""
        try:
            # Create version table if it doesn't exist
            self.cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY
                )
            """
            )

            # Get current version
            self.cursor.execute("SELECT version FROM schema_version")
            result = self.cursor.fetchone()
            current_version = result[0] if result else 0

            if current_version < self.SCHEMA_VERSION:
                logging.info(
                    f"Updating database from version {current_version} to {self.SCHEMA_VERSION}"
                )

                # Run all necessary migrations in order
                for version in range(
                    current_version + 1, self.SCHEMA_VERSION + 1
                ):
                    migration_method = getattr(
                        self, f"_migrate_to_v{version}", None
                    )
                    if migration_method:
                        logging.info(f"Running migration to version {version}")
                        print(f"Running migration to version {version}")
                        migration_method()

                # Update schema version
                self.cursor.execute("DELETE FROM schema_version")
                self.cursor.execute(
                    "INSERT INTO schema_version (version) VALUES (?)",
                    (self.SCHEMA_VERSION,),
                )
                self.db.commit()

            logging.info(f"Database schema is at version {self.SCHEMA_VERSION}")

        except Exception as e:
            logging.error(f"Migration failed: {str(e)}")
            self.db.rollback()
            raise

    def _migrate_to_v1(self):
        from server.database.defaults.prompts import DEFAULT_PROMPTS

        """Initial schema setup"""
        self.cursor.execute(
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
        self.cursor.execute(
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
        self.cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_encounter_date ON patients (encounter_date)"
        )
        self.cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_ur_number ON patients (ur_number)"
        )
        self.cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_template_key ON patients (template_key)"
        )

        # Dashboard tables
        self.cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS rss_feeds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL UNIQUE,
                title TEXT,
                last_refreshed TEXT
            )
        """
        )

        self.cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task TEXT NOT NULL,
                completed BOOLEAN NOT NULL DEFAULT 0
            )
        """
        )

        self.cursor.execute(
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

        self.cursor.execute(
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
        self.cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """
        )

        self.cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS prompts (
                key TEXT PRIMARY KEY,
                system TEXT
            )
        """
        )

        self.cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS options (
                category TEXT,
                key TEXT,
                value TEXT,
                PRIMARY KEY (category, key)
            )
        """
        )

        self.cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        self.cursor.execute(
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

        self.cursor.execute(
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
            self.cursor.execute(
                "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
                (key, json.dumps(value)),
            )
            for key, prompt in prompts_data["prompts"].items():
                if key != "reasoning":  # Skip reasoning prompt for v1
                    self.cursor.execute(
                        """
                            INSERT OR REPLACE INTO prompts
                            (key, system)
                            VALUES (?, ?)
                            """,
                        (
                            key,
                            prompt.get("system", ""),
                        ),
                    )

        default_options = prompts_data["options"].get("general", {})
        for category, options in prompts_data["options"].items():
            if category != "reasoning":
                for key, value in options.items():
                    actual_value = options.get(key, default_options.get(key))
                    if actual_value is not None:
                        self.cursor.execute(
                            "INSERT OR REPLACE INTO options (category, key, value) VALUES (?, ?, ?)",
                            (category, key, json.dumps(actual_value)),
                        )

        letter_templates = DefaultLetters.get_default_letter_templates()
        for letter_templates in letter_templates:
            self.cursor.execute(
                """
                INSERT INTO letter_templates (id, name, instructions, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            """,
                letter_templates,
            )

    def _migrate_to_v2(self):
        """Add reasoning analysis support"""
        from server.database.defaults.prompts import DEFAULT_PROMPTS

        try:
            # Add reasoning_output column to patients table
            self.cursor.execute(
                """
                ALTER TABLE patients
                ADD COLUMN reasoning_output JSON
                """
            )

            # Add index for encounter_date to optimize nightly processing
            self.cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_reasoning_date
                ON patients(encounter_date, reasoning_output)
                """
            )

            # Add configuration for reasoning model and toggle
            self.cursor.execute(
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
            self.cursor.execute(
                """
                INSERT OR IGNORE INTO prompts (key, system)
                VALUES (?, ?)
                """,
                ("reasoning", reasoning_prompt),
            )

            # Add reasoning options
            reasoning_options = defaults["options"]["reasoning"]
            for key, value in reasoning_options.items():
                self.cursor.execute(
                    """
                    INSERT OR IGNORE INTO options (category, key, value)
                    VALUES (?, ?, ?)
                    """,
                    ("reasoning", key, str(value)),
                )

            self.db.commit()
            logging.info("Successfully migrated to schema version 2")

        except Exception as e:
            logging.error(f"Error during v2 migration: {e}")
            self.db.rollback()
            raise

    def _migrate_to_v3(self):
        """Migrate configuration from Ollama-based setup to OpenAI-compatible setup and update template schema"""
        from server.database.defaults.templates import DefaultTemplates

        try:
            # Part 1: Handle configuration migration
            # Get existing configuration values
            self.cursor.execute("SELECT key, value FROM config")
            existing_config = {}
            for row in self.cursor.fetchall():
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
                "SECONDARY_MODEL": existing_config.get(
                    "SECONDARY_MODEL", "&nbsp;"
                ),
                "EMBEDDING_MODEL": existing_config.get(
                    "EMBEDDING_MODEL", "&nbsp;"
                ),
                "REASONING_MODEL": existing_config.get(
                    "REASONING_MODEL", "&nbsp;"
                ),
                "REASONING_ENABLED": existing_config.get(
                    "REASONING_ENABLED", False
                ),
                # New configuration keys
                "LLM_PROVIDER": llm_provider,
                "LLM_API_KEY": llm_api_key,
                "LLM_BASE_URL": llm_base_url,
            }

            # Remove old Ollama-specific configuration
            self.cursor.execute(
                "DELETE FROM config WHERE key = 'OLLAMA_BASE_URL'"
            )

            # Update/add all configuration values
            for key, value in config_mapping.items():
                self.cursor.execute(
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
            self.cursor.execute(
                "SELECT template_key, template_name, fields FROM clinical_templates"
            )
            templates = self.cursor.fetchall()

            for template in templates:
                template_key = template["template_key"]
                fields = json.loads(template["fields"])
                updated_fields = []

                # Determine template type (phlox, soap, progress, or custom)
                template_base = template_key.split("_")[0]
                is_default_template = (
                    template_base in default_fields_by_template
                )

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
                self.cursor.execute(
                    "UPDATE clinical_templates SET fields = ? WHERE template_key = ?",
                    (json.dumps(updated_fields), template_key),
                )

            self.db.commit()
            logging.info("Successfully migrated to schema version 3")

        except Exception as e:
            logging.error(f"Error during v3 migration: {e}")
            self.db.rollback()
            raise

    def test_database(self):
        """Test database functionality with sample data."""
        try:
            # Test template
            template_data = {
                "field_key": "test_template",
                "template_name": "Test Template",
                "fields": [
                    {
                        "field_key": "presenting_complaint",
                        "field_name": "Presenting Complaint",
                        "field_type": "text",
                        "persistent": True,
                    }
                ],
            }

            # Insert test template
            self.cursor.execute(
                """
                INSERT INTO clinical_templates (template_key, template_name, fields)
                VALUES (?, ?, ?)
                """,
                ("test_template", "Test Template", json.dumps(template_data)),
            )

            # Insert test patient with template
            template_patient_data = {"presenting_complaint": "Test complaint"}

            self.cursor.execute(
                """
                INSERT INTO patients (
                    name, dob, ur_number, gender, encounter_date,
                    template_key, template_data, raw_transcription,
                    transcription_duration, process_duration
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "Test User",
                    "2000-01-01",
                    "UR12345",
                    "M",
                    datetime.now().isoformat(),
                    "test_template",
                    json.dumps(template_patient_data),
                    "Test transcription",
                    1.0,
                    1.0,
                ),
            )

            self.db.commit()
            return True
        except Exception as e:
            logging.error(f"Database test failed: {str(e)}")
            self.db.rollback()
            raise

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
        if self.is_test:
            tables = [
                "patients",
                "clinical_templates",
                "rss_feeds",
                "todos",
                "rss_items",
                "config",
                "prompts",
                "options",
                "schema_version",
            ]
            try:
                for table in tables:
                    self.cursor.execute(f"DELETE FROM {table}")
                self.db.commit()
            except Exception as e:
                logging.error(f"Failed to clear test database: {str(e)}")
                raise

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


db = PatientDatabase()
