import json
from threading import Lock
from server.database.connection import db


class ConfigManager:
    """Manages configuration settings, prompts, and options."""

    _instance = None
    _lock = Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ConfigManager, cls).__new__(cls)
                cls._instance.db = db
                if cls._instance._is_database_empty():
                    cls._instance._initialize_database()
                cls._instance._load_configs()
            return cls._instance

    def _is_database_empty(self):
        """Checks if the config, prompts, and options tables are empty."""
        self.db.cursor.execute("SELECT COUNT(*) FROM config")
        config_count = self.db.cursor.fetchone()[0]
        self.db.cursor.execute("SELECT COUNT(*) FROM prompts")
        prompts_count = self.db.cursor.fetchone()[0]
        self.db.cursor.execute("SELECT COUNT(*) FROM options")
        options_count = self.db.cursor.fetchone()[0]
        return config_count == 0 and prompts_count == 0 and options_count == 0

    def _load_configs(self):
        """Loads configurations, prompts, and options from the database."""
        self.config = {}
        self.prompts = {}

        # Load config
        self.db.cursor.execute("SELECT key, value FROM config")
        for row in self.db.cursor.fetchall():
            self.config[row["key"]] = json.loads(row["value"])

        # Load prompts
        self.db.cursor.execute("SELECT key, system FROM prompts")
        for row in self.db.cursor.fetchall():
            self.prompts[row["key"]] = {"system": row["system"]}

        # Load options
        self.options = {}
        self.db.cursor.execute("SELECT category, key, value FROM options")
        for row in self.db.cursor.fetchall():
            category = row["category"]
            key = row["key"]
            value = json.loads(row["value"])
            if category not in self.options:
                self.options[category] = {}
            self.options[category][key] = value

    def get_config(self):
        """Returns the configuration settings."""
        return self.config

    def get_prompts(self):
        """Returns the prompts."""
        return self.prompts

    def get_prompts_and_options(self):
        """Returns the prompts and options in a structured format."""
        structured_prompts = {"prompts": self.prompts, "options": self.options}
        return structured_prompts

    def update_config(self, new_config):
        """Updates the configuration settings in the database."""
        for key, value in new_config.items():
            self.db.cursor.execute(
                "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
                (key, json.dumps(value)),
            )
        self.db.commit()
        self._load_configs()

    def update_prompts(self, new_prompts):
        """Updates the prompts in the database."""
        for key, prompt in new_prompts.items():
            self.db.cursor.execute(
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
        self.db.commit()
        self._load_configs()

    def get_all_options(self):
        """Returns all options."""
        return self.options

    def get_options(self, category):
        """Returns options for a specific category."""
        return self.options.get(category, {})

    def update_options(self, category, new_options):
        """Updates options for a specific category in the database."""
        if category not in self.options:
            self.options[category] = {}

        # Update only if the key is present and convert types
        for key, value in new_options.items():
            if (
                key in self.options[category]
                or key == "num_ctx"
                or key == "temperature"
            ):

                # Convert types before saving
                if key == "temperature":
                    value = float(value)
                elif key == "num_ctx":
                    value = int(value)

                self.options[category][key] = value

                # Save to database with converted value
                self.db.cursor.execute(
                    "INSERT OR REPLACE INTO options (category, key, value) VALUES (?, ?, ?)",
                    (category, key, json.dumps(value)),
                )

        self.db.commit()
        self._load_configs()

    def reset_to_defaults(self):
        """Resets prompts and options to their default values."""
        # Clear existing data for prompts and options
        self.db.cursor.execute("DELETE FROM prompts")
        self.db.cursor.execute("DELETE FROM options")
        self.db.commit()

        self._initialize_database()

    def _initialize_database(self):
        """Initialize database if empty (now just a check)"""
        self.db.cursor.execute("SELECT COUNT(*) FROM config")
        config_count = self.db.cursor.fetchone()[0]
        if config_count == 0:
            self._load_configs()  # Just load whatever is there

    def get_user_settings(self):
        """Retrieves user settings from the database."""
        self.db.cursor.execute(
            """
            SELECT name, specialty,
                quick_chat_1_title, quick_chat_1_prompt,
                quick_chat_2_title, quick_chat_2_prompt,
                quick_chat_3_title, quick_chat_3_prompt,
                default_letter_template_id
            FROM user_settings LIMIT 1
        """
        )
        result = self.db.cursor.fetchone()
        if result:
            return dict(result)
        return {
            "name": "",
            "specialty": "",
            "quick_chat_1_title": "Critique my plan",
            "quick_chat_1_prompt": "Critique my plan",
            "quick_chat_2_title": "Any additional investigations",
            "quick_chat_2_prompt": "Any additional investigations",
            "quick_chat_3_title": "Any differentials to consider",
            "quick_chat_3_prompt": "Any differentials to consider",
            "default_letter_template_id": None,
        }

def get_user_settings(self):
    """Retrieves user settings from the database."""
    self.db.cursor.execute(
        """
        SELECT name, specialty,
            quick_chat_1_title, quick_chat_1_prompt,
            quick_chat_2_title, quick_chat_2_prompt,
            quick_chat_3_title, quick_chat_3_prompt,
            default_letter_template_id,
            has_completed_splash_screen
        FROM user_settings LIMIT 1
        """
    )
    result = self.db.cursor.fetchone()

    if result:
        return dict(result)
    return {
        "name": "",
        "specialty": "",
        "quick_chat_1_title": "Critique my plan",
        "quick_chat_1_prompt": "Critique my plan",
        "quick_chat_2_title": "Any additional investigations",
        "quick_chat_2_prompt": "Any additional investigations",
        "quick_chat_3_title": "Any differentials to consider",
        "quick_chat_3_prompt": "Any differentials to consider",
        "default_letter_template_id": None,
        "has_completed_splash_screen": False,
    }


def update_user_settings(self, settings: dict):
    self.db.cursor.execute("DELETE FROM user_settings")
    self.db.cursor.execute(
        """
        INSERT INTO user_settings (
            name, specialty,
            quick_chat_1_title, quick_chat_1_prompt,
            quick_chat_2_title, quick_chat_2_prompt,
            quick_chat_3_title, quick_chat_3_prompt,
            default_letter_template_id,
            has_completed_splash_screen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            settings.get("name", ""),
            settings.get("specialty", ""),
            settings.get("quick_chat_1_title", "Critique my plan"),
            settings.get("quick_chat_1_prompt", "Critique my plan"),
            settings.get("quick_chat_2_title", "Any additional investigations"),
            settings.get("quick_chat_2_prompt", "Any additional investigations"),
            settings.get("quick_chat_3_title", "Any differentials to consider"),
            settings.get("quick_chat_3_prompt", "Any differentials to consider"),
            settings.get("default_letter_template_id"),
            bool(settings.get("has_completed_splash_screen", False))
        )
    )
    self.db.commit()



config_manager = ConfigManager()
