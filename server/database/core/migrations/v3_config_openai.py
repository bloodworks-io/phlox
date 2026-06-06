"""Migration v3: Migrate config from Ollama to OpenAI-compatible setup and update template schema."""

import json

from server.database.config.defaults.templates import DefaultTemplates


def migrate(cursor, _db):
    """Migrate Ollama config to OpenAI-compatible structure and add template style_example/format_schema."""
    # Part 1: Configuration migration
    cursor.execute("SELECT key, value FROM config")
    existing_config = {}
    for row in cursor.fetchall():
        existing_config[row["key"]] = json.loads(row["value"])

    ollama_base_url = existing_config.get("OLLAMA_BASE_URL", "")

    if ollama_base_url:
        llm_provider = "ollama"
        llm_base_url = ollama_base_url
        llm_api_key = ""
    else:
        llm_provider = "ollama"
        llm_base_url = ""
        llm_api_key = ""

    config_mapping = {
        "WHISPER_BASE_URL": existing_config.get("WHISPER_BASE_URL", ""),
        "WHISPER_MODEL": existing_config.get("WHISPER_MODEL", ""),
        "WHISPER_KEY": existing_config.get("WHISPER_KEY", ""),
        "PRIMARY_MODEL": existing_config.get("PRIMARY_MODEL", ""),
        "SECONDARY_MODEL": existing_config.get("SECONDARY_MODEL", ""),
        "EMBEDDING_MODEL": existing_config.get("EMBEDDING_MODEL", ""),
        "REASONING_MODEL": existing_config.get("REASONING_MODEL", ""),
        "REASONING_ENABLED": existing_config.get("REASONING_ENABLED", False),
        "LLM_PROVIDER": llm_provider,
        "LLM_API_KEY": llm_api_key,
        "LLM_BASE_URL": llm_base_url,
    }

    cursor.execute("DELETE FROM config WHERE key = 'OLLAMA_BASE_URL'")

    for key, value in config_mapping.items():
        cursor.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
            (key, json.dumps(value)),
        )

    # Part 2: Template schema migration
    default_templates = DefaultTemplates.get_default_templates()
    default_fields_by_template = {}

    for template in default_templates:
        template_key_base = template["template_key"].split("_")[0]
        default_fields_by_template[template_key_base] = {
            field["field_key"]: field for field in template["fields"]
        }

    cursor.execute("SELECT template_key, template_name, fields FROM clinical_templates")
    templates = cursor.fetchall()

    for template in templates:
        template_key = template["template_key"]
        fields = json.loads(template["fields"])
        updated_fields = []

        template_base = template_key.split("_")[0]
        is_default_template = template_base in default_fields_by_template

        for field in fields:
            updated_field = field.copy()

            if "style_example" not in updated_field:
                if (
                    is_default_template
                    and field["field_key"] in default_fields_by_template[template_base]
                ):
                    default_field = default_fields_by_template[template_base][field["field_key"]]
                    updated_field["style_example"] = default_field.get("style_example", "")

                    if "format_schema" in default_field:
                        updated_field["format_schema"] = default_field["format_schema"]
                else:
                    updated_field["style_example"] = ""

            updated_fields.append(updated_field)

        cursor.execute(
            "UPDATE clinical_templates SET fields = ? WHERE template_key = ?",
            (json.dumps(updated_fields), template_key),
        )
