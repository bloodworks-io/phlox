"""
Tests for configuration endpoints.
Uses TestClient and checks JSON response structure.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.api.config import router

app = FastAPI()
app.include_router(router, prefix="/api/config")
client = TestClient(app)


def is_valid_json(response):
    try:
        response.json()
        return True
    except ValueError:
        return False


def test_get_prompts():
    response = client.get("/api/config/prompts")
    assert response.status_code == 200
    assert is_valid_json(response)
    data = response.json()
    # Expect prompts to be a dict
    assert isinstance(data, dict)


def test_get_config():
    response = client.get("/api/config/global")
    assert response.status_code == 200
    assert is_valid_json(response)
    data = response.json()
    # Expect config to be a dict
    assert isinstance(data, dict)


def test_get_all_options():
    response = client.get("/api/config/options")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)


def test_update_prompts():
    new_prompts = {
        "TEST_PROMPT": {
            "system": "Test System Prompt",
        }
    }
    response = client.post("/api/config/prompts", json=new_prompts)
    assert response.status_code == 200
    data = response.json()
    assert "message" in data or "updated" in data.get("message", "").lower()


def test_update_config():
    new_config = {"TEST_CONFIG": "test_value"}
    response = client.post("/api/config/global", json=new_config)
    assert response.status_code == 200
    data = response.json()
    message = data.get("message", "")
    assert "message" in data and ("success" in message.lower())


def test_update_options():
    new_options = {"TEST_OPTION": "test_option_value"}
    response = client.post("/api/config/options/TEST_CATEGORY", json=new_options)
    assert response.status_code == 200
    data = response.json()
    assert "updated" in data.get("message", "").lower()


def test_reset_options_to_defaults():
    response = client.post("/api/config/options/reset-to-defaults")
    assert response.status_code == 200
    data = response.json()
    assert "reset" in data.get("message", "").lower()


def test_preferred_language_defaults_to_en():
    """preferred_language should default to 'en' on a fresh database."""
    response = client.get("/api/config/user")
    assert response.status_code == 200
    assert response.json().get("preferred_language") == "en"


def test_preferred_language_round_trip():
    """preferred_language should persist and read back through the user settings API."""
    response = client.post("/api/config/user", json={"preferred_language": "es"})
    assert response.status_code == 200

    response = client.get("/api/config/user")
    assert response.status_code == 200
    assert response.json().get("preferred_language") == "es"

    # Restore default to keep the shared test DB in a known state.
    client.post("/api/config/user", json={"preferred_language": "en"})


def test_preferred_language_preserves_other_settings():
    """Updating preferred_language must not clobber other user settings (read-modify-write)."""
    client.post("/api/config/user", json={"name": "Dr Roundtrip", "specialty": "cardiology"})

    response = client.post("/api/config/user", json={"preferred_language": "fr"})
    assert response.status_code == 200

    settings = client.get("/api/config/user").json()
    assert settings["preferred_language"] == "fr"
    assert settings["name"] == "Dr Roundtrip"
    assert settings["specialty"] == "cardiology"

    # Restore defaults.
    client.post("/api/config/user", json={"preferred_language": "en", "name": "", "specialty": ""})


def test_capabilities_remote_mode_unrestricted():
    """In remote mode (default), stt_languages is the unrestricted sentinel."""
    response = client.get("/api/config/capabilities")
    assert response.status_code == 200
    data = response.json()
    assert data["stt_mode"] == "remote"
    assert data["stt_languages"] == ["*"]


def test_capabilities_local_mode_reports_active_model_languages():
    """In local mode, stt_languages follows the active model's declared languages."""
    client.post("/api/config/global", json={"LLM_PROVIDER": "local", "WHISPER_BASE_URL": ""})

    data = client.get("/api/config/capabilities").json()
    assert data["stt_mode"] == "local"
    # No model selected in the test DB -> defaults to the English medical model.
    assert data["stt_languages"] == ["en"]

    # Restore so other tests see remote mode again.
    client.post("/api/config/global", json={"LLM_PROVIDER": "openai", "WHISPER_BASE_URL": ""})


def test_language_directive_injected_only_for_non_english(monkeypatch):
    """The LLM output-language directive is injected only for non-English."""
    from server.database.config.manager import config_manager
    from server.llm_client.client import AsyncLLMClient

    llm = AsyncLLMClient(provider_type="openai", base_url="http://localhost:9999")
    base_messages = [{"role": "user", "content": "hello"}]

    # English (default): no directive, behavior unchanged.
    monkeypatch.setattr(config_manager, "get_user_settings", lambda: {"preferred_language": "en"})
    assert llm._with_language_directive(base_messages) == base_messages

    # Spanish: a system directive is prepended; original messages preserved.
    monkeypatch.setattr(config_manager, "get_user_settings", lambda: {"preferred_language": "es"})
    out = llm._with_language_directive(base_messages)
    assert out[0]["role"] == "system"
    assert "Spanish" in out[0]["content"]
    assert out[1:] == base_messages

    # Spanish with an existing leading system message: directive must MERGE into
    # it (one system message), not prepend a second — provider templates reject
    # multiple system messages.
    with_system = [{"role": "system", "content": "original"}, {"role": "user", "content": "hi"}]
    out = llm._with_language_directive(with_system)
    assert sum(1 for m in out if m["role"] == "system") == 1
    assert out[0]["content"].startswith("You are operating in a Spanish-speaking")
    assert out[0]["content"].endswith("original")
    assert out[1:] == with_system[1:]


def test_policy_keys_present_in_global_config():
    """Migration v9 backfills the three policy keys into config KV."""
    data = client.get("/api/config/global").json()
    assert data["DISABLED_TOOLS"] == ["pubmed_search", "wiki_search"]
    assert data["STORE_ORIGINAL_PDFS"] is False
    assert data["REQUIRE_SCRIBE_CONSENT"] is False


def test_policy_keys_round_trip_via_global():
    """Policy keys are read/written via the global config endpoint."""
    client.post(
        "/api/config/global",
        json={
            "DISABLED_TOOLS": ["pubmed_search"],
            "STORE_ORIGINAL_PDFS": True,
            "REQUIRE_SCRIBE_CONSENT": True,
        },
    )
    data = client.get("/api/config/global").json()
    assert data["DISABLED_TOOLS"] == ["pubmed_search"]
    assert data["STORE_ORIGINAL_PDFS"] is True
    assert data["REQUIRE_SCRIBE_CONSENT"] is True

    # Restore defaults so other tests see a known state.
    client.post(
        "/api/config/global",
        json={
            "DISABLED_TOOLS": ["pubmed_search", "wiki_search"],
            "STORE_ORIGINAL_PDFS": False,
            "REQUIRE_SCRIBE_CONSENT": False,
        },
    )


def test_post_user_filters_migrated_keys():
    """POST /user must drop disabled_tools/advanced_options (relocated to config)."""
    client.post(
        "/api/config/user",
        json={
            "disabled_tools": ["should_be_dropped"],
            "advanced_options": {"store_original_pdfs": True},
            "name": "FilterCheck",
        },
    )
    settings = client.get("/api/config/user").json()
    assert "disabled_tools" not in settings
    assert "advanced_options" not in settings
    assert settings["name"] == "FilterCheck"

    # The policy keys live in global config, unaffected by the user POST.
    config = client.get("/api/config/global").json()
    assert "should_be_dropped" not in config["DISABLED_TOOLS"]

    # Restore.
    client.post("/api/config/user", json={"name": ""})


def test_v8_backfills_policy_keys_from_user_settings():
    """Migration v8 reads the legacy user_settings columns and writes config KV."""
    import json

    from server.database.config.manager import config_manager
    from server.database.core.migrations.v8_preferred_language import migrate

    config_manager.refresh_db()
    # Plant custom values in the legacy (now-dead) columns.
    with config_manager.db.transaction() as cursor:
        cursor.execute(
            "UPDATE user_settings SET disabled_tools = ?, advanced_options = ?",
            (
                json.dumps(["legacy_tool"]),
                json.dumps({"store_original_pdfs": True, "require_scribe_consent": True}),
            ),
        )
        # Re-run the migration (idempotent INSERT OR REPLACE).
        migrate(cursor, None)

    config_manager._load_configs()
    config = config_manager.get_config()
    assert config["DISABLED_TOOLS"] == ["legacy_tool"]
    assert config["STORE_ORIGINAL_PDFS"] is True
    assert config["REQUIRE_SCRIBE_CONSENT"] is True

    # Restore defaults.
    client.post(
        "/api/config/global",
        json={
            "DISABLED_TOOLS": ["pubmed_search", "wiki_search"],
            "STORE_ORIGINAL_PDFS": False,
            "REQUIRE_SCRIBE_CONSENT": False,
        },
    )
