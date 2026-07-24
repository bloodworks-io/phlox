import json
import logging
from threading import Lock

import sqlcipher3 as sqlite3
from server.database.config.defaults.prompts import DEFAULT_PROMPTS
from server.database.core.connection import get_db, is_db_initialized

logger = logging.getLogger(__name__)


class ConfigManager:
    """Manages configuration settings, prompts, and options."""

    _instance = None
    _lock = Lock()
    _cache_lock = Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance.db = get_db()
                if cls._instance._is_database_empty():
                    cls._instance._initialize_database()
                cls._instance._load_configs()
            return cls._instance

    def refresh_db(self):
        """Refresh database reference if connection is closed.

        This handles uvicorn reload scenarios where the database singleton
        is recreated but ConfigManager still holds the old reference.
        """
        if not is_db_initialized():
            return

        try:
            # Test if connection is still alive
            with self.db.read() as cursor:
                cursor.execute("SELECT 1")
        except (sqlite3.ProgrammingError, sqlite3.OperationalError):
            # Connection is closed or broken, get fresh reference
            self.db = get_db()

    def _is_database_empty(self):
        """Checks if the config, prompts, and options tables are empty."""
        self.refresh_db()
        with self.db.read() as cursor:
            cursor.execute("SELECT COUNT(*) FROM config")
            config_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM prompts")
            prompts_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM options")
            options_count = cursor.fetchone()[0]
        return config_count == 0 and prompts_count == 0 and options_count == 0

    def _load_configs(self):
        """Loads configurations, prompts, and options from the database.

        Builds into local dicts and swaps them in atomically so concurrent
        readers never observe a partially populated cache.
        """
        self.refresh_db()
        with self.db.read() as cursor:
            config = {}
            cursor.execute("SELECT key, value FROM config")
            for row in cursor.fetchall():
                config[row["key"]] = json.loads(row["value"])

            prompts = {}
            cursor.execute("SELECT key, system FROM prompts")
            for row in cursor.fetchall():
                prompts[row["key"]] = {"system": row["system"]}

            options = {}
            cursor.execute("SELECT category, key, value FROM options")
            for row in cursor.fetchall():
                category = row["category"]
                key = row["key"]
                value = json.loads(row["value"])
                if category not in options:
                    options[category] = {}
                options[category][key] = value

            with self._cache_lock:
                self.config = config
                self.prompts = prompts
                self.options = options

    def get_config(self):
        """Returns the configuration settings with fallbacks applied."""
        with self._cache_lock:
            config = self.config.copy()
        # Fall back to PRIMARY_MODEL if SECONDARY_MODEL is not set
        if not config.get("SECONDARY_MODEL"):
            config["SECONDARY_MODEL"] = config.get("PRIMARY_MODEL", "")
        return config

    def get_prompts(self):
        """Returns the prompts."""
        with self._cache_lock:
            return self.prompts

    def get_prompts_and_options(self):
        """Returns the prompts and options in a structured format."""
        with self._cache_lock:
            return {"prompts": self.prompts, "options": self.options}

    def update_config(self, new_config):
        """Updates the configuration settings in the database."""
        self.refresh_db()
        # If PRIMARY_MODEL is being updated, sync REASONING_MODEL to match
        if "PRIMARY_MODEL" in new_config:
            new_config["REASONING_MODEL"] = new_config["PRIMARY_MODEL"]

        with self.db.transaction() as cursor:
            for key, value in new_config.items():
                cursor.execute(
                    "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
                    (key, json.dumps(value)),
                )
        self._load_configs()

    def update_prompts(self, new_prompts):
        """Updates the prompts in the database."""
        self.refresh_db()
        with self.db.transaction() as cursor:
            for key, prompt in new_prompts.items():
                cursor.execute(
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
        self._load_configs()

    def get_all_options(self):
        """Returns all options."""
        with self._cache_lock:
            return self.options

    def get_options(self, category):
        """Returns options for a specific category."""
        with self._cache_lock:
            return self.options.get(category, {})

    def update_options(self, category, new_options):
        """Updates options for a specific category in the database."""
        self.refresh_db()
        # Snapshot existing keys for the category; cache is rebuilt from DB
        # after commit, so we never mutate self.options before the write lands.
        with self._cache_lock:
            existing_keys = set(self.options.get(category, {}).keys())

        with self.db.transaction() as cursor:
            # Update only if the key is present and convert types
            for key, value in new_options.items():
                if key in existing_keys or key == "num_ctx" or key == "temperature":
                    # Convert types before saving
                    if key == "temperature":
                        value = float(value)
                    elif key == "num_ctx":
                        value = int(value)

                    cursor.execute(
                        "INSERT OR REPLACE INTO options (category, key, value) VALUES (?, ?, ?)",
                        (category, key, json.dumps(value)),
                    )
        self._load_configs()

    def reset_options_to_defaults(self):
        """Resets options to their default values. Preserves prompts and config."""
        self.refresh_db()

        with self.db.transaction() as cursor:
            cursor.execute("DELETE FROM options")

            # Re-seed default options from DEFAULT_PROMPTS
            default_options = DEFAULT_PROMPTS["options"].get("general", {})
            for category, options in DEFAULT_PROMPTS["options"].items():
                if category != "reasoning":
                    for key, _value in options.items():
                        actual_value = options.get(key, default_options.get(key))
                        if actual_value is not None:
                            cursor.execute(
                                "INSERT OR REPLACE INTO options (category, key, value) VALUES (?, ?, ?)",
                                (category, key, json.dumps(actual_value)),
                            )
        self._load_configs()

    def _initialize_database(self):
        """Initialize database if empty (now just a check)"""
        self.refresh_db()
        with self.db.read() as cursor:
            cursor.execute("SELECT COUNT(*) FROM config")
            config_count = cursor.fetchone()[0]
        if config_count == 0:
            self._load_configs()  # Just load whatever is there

    def get_user_settings(self):
        """Retrieves user settings from the database."""
        self.refresh_db()
        with self.db.read() as cursor:
            cursor.execute("""
                SELECT name, specialty,
                    quick_chat_1_title, quick_chat_1_prompt,
                    quick_chat_2_title, quick_chat_2_prompt,
                    quick_chat_3_title, quick_chat_3_prompt,
                    default_template_key,
                    default_letter_template_id,
                    has_completed_splash_screen,
                    scribe_is_ambient,
                    disabled_tools,
                    advanced_options
                FROM user_settings LIMIT 1
                """)
            result = cursor.fetchone()

        if result:
            settings = dict(result)
            # Ensure the splash screen flag is a proper boolean
            if "has_completed_splash_screen" in settings:
                settings["has_completed_splash_screen"] = bool(
                    settings["has_completed_splash_screen"]
                )
            if "scribe_is_ambient" in settings:
                settings["scribe_is_ambient"] = bool(settings["scribe_is_ambient"])
            if settings.get("disabled_tools"):
                settings["disabled_tools"] = json.loads(settings["disabled_tools"])
            else:
                settings["disabled_tools"] = ["pubmed_search", "wiki_search"]
            if settings.get("advanced_options"):
                settings["advanced_options"] = json.loads(settings["advanced_options"])
            else:
                settings["advanced_options"] = {}
            return settings
        return {
            "name": "",
            "specialty": "",
            "quick_chat_1_title": "Review my plan",
            "quick_chat_1_prompt": "Review my plan",
            "quick_chat_2_title": "Additional points to review",
            "quick_chat_2_prompt": "Additional points to review",
            "quick_chat_3_title": "Other conditions worth reviewing",
            "quick_chat_3_prompt": "Other conditions worth reviewing",
            "default_template_key": None,
            "default_letter_template_id": None,
            "has_completed_splash_screen": False,
            "scribe_is_ambient": True,
            "disabled_tools": ["pubmed_search", "wiki_search"],
            "advanced_options": {},
        }

    def update_user_settings(self, settings: dict):
        self.refresh_db()
        # Read-modify-write under one transaction so a concurrent update
        # cannot interleave with the DELETE/INSERT below.
        with self.db.transaction() as cursor:
            existing = self._read_user_settings(cursor)
            settings = {**existing, **settings}
            cursor.execute("DELETE FROM user_settings")
            cursor.execute(
                """
                INSERT INTO user_settings (
                    name, specialty,
                    quick_chat_1_title, quick_chat_1_prompt,
                    quick_chat_2_title, quick_chat_2_prompt,
                    quick_chat_3_title, quick_chat_3_prompt,
                    default_template_key,
                    default_letter_template_id,
                    has_completed_splash_screen,
                    scribe_is_ambient,
                    disabled_tools,
                    advanced_options
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    settings.get("name", ""),
                    settings.get("specialty", ""),
                    settings.get("quick_chat_1_title", "Review my plan"),
                    settings.get("quick_chat_1_prompt", "Review my plan"),
                    settings.get("quick_chat_2_title", "Additional points to review"),
                    settings.get("quick_chat_2_prompt", "Additional points to review"),
                    settings.get("quick_chat_3_title", "Other conditions worth reviewing"),
                    settings.get("quick_chat_3_prompt", "Other conditions worth reviewing"),
                    settings.get("default_template_key"),
                    settings.get("default_letter_template_id"),
                    bool(settings.get("has_completed_splash_screen", False)),
                    bool(settings.get("scribe_is_ambient", True)),
                    json.dumps(settings.get("disabled_tools", ["pubmed_search", "wiki_search"])),
                    json.dumps(settings.get("advanced_options", {})),
                ),
            )

    @staticmethod
    def _read_user_settings(cursor) -> dict:
        cursor.execute("SELECT * FROM user_settings LIMIT 1")
        result = cursor.fetchone()
        if not result:
            return {}
        settings = dict(result)
        if settings.get("disabled_tools"):
            settings["disabled_tools"] = json.loads(settings["disabled_tools"])
        else:
            settings["disabled_tools"] = ["pubmed_search", "wiki_search"]
        if settings.get("advanced_options"):
            settings["advanced_options"] = json.loads(settings["advanced_options"])
        else:
            settings["advanced_options"] = {}
        return settings


config_manager = ConfigManager()
