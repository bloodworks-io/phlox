"""Migration v1: Initial schema setup."""

import json

from server.database.config.defaults.letters import DefaultLetters
from server.database.config.defaults.prompts import DEFAULT_PROMPTS


def migrate(cursor, _db):
    """Create all core tables and seed default data."""
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

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_encounter_date ON patients (encounter_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ur_number ON patients (ur_number)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_template_key ON patients (template_key)")

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
            quick_chat_1_title TEXT DEFAULT 'Review my plan',
            quick_chat_1_prompt TEXT DEFAULT 'Review my plan',
            quick_chat_2_title TEXT DEFAULT 'Additional points to review',
            quick_chat_2_prompt TEXT DEFAULT 'Additional points to review',
            quick_chat_3_title TEXT DEFAULT 'Other conditions worth reviewing',
            quick_chat_3_prompt TEXT DEFAULT 'Other conditions worth reviewing'
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

    default_config = {
        "WHISPER_BASE_URL": "",
        "WHISPER_MODEL": "",
        "WHISPER_KEY": "",
        "OLLAMA_BASE_URL": "",
        "PRIMARY_MODEL": "",
        "SECONDARY_MODEL": "",
        "EMBEDDING_MODEL": "",
        "DAILY_SUMMARY": "",
    }

    for key, value in default_config.items():
        cursor.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
            (key, json.dumps(value)),
        )
    for key, prompt in prompts_data["prompts"].items():
        if key != "reasoning":
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
            for key, _value in options.items():
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
