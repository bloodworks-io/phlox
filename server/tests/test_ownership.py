"""Ownership scoping: encounters, templates, todos filtered by the current user."""

from server.database.core.connection import get_db
from server.database.repositories.encounter import (
    get_patient_by_id,
    get_patients_by_date,
    save_patient,
)
from server.database.repositories.todo import add_todo_item, get_todo_items
from server.database.repositories.users import create_user
from server.schemas.patient import Patient
from server.utils.current_user import CurrentUser, set_current_user


def _as(user_id: int, role: str = "clinician"):
    set_current_user(CurrentUser(user_id, f"user{user_id}", role))


def _save(note_id_ur: str, user_id: int) -> int:
    _as(user_id)
    patient = Patient(
        name=f"Owner{user_id}",
        first_name="Test",
        last_name=f"Owner{user_id}",
        ur_number=note_id_ur,
        encounter_date="2026-01-01",
        template_key="phlox_01",
        template_data={},
        raw_transcription="",
    )
    return save_patient(patient)


def _cleanup(ur_numbers: list[str]):
    set_current_user(None)  # admin/unscoped so cleanup sees everything
    with get_db().transaction() as cursor:
        for ur in ur_numbers:
            cursor.execute("DELETE FROM encounters WHERE ur_number = ?", (ur,))
            cursor.execute("DELETE FROM patient_profiles WHERE ur_number = ?", (ur,))


def test_encounters_scoped_by_owner():
    a, b = create_user("own_a"), create_user("own_b")
    try:
        id_a = _save("SCOPEA1", a)
        id_b = _save("SCOPEB1", b)

        _as(a)
        rows = get_patients_by_date("2026-01-01")
        assert [r["id"] for r in rows] == [id_a]
        assert get_patient_by_id(id_a) is not None
        assert get_patient_by_id(id_b) is None  # invisible -> 404 at the API layer

        _as(b)
        rows = get_patients_by_date("2026-01-01")
        assert [r["id"] for r in rows] == [id_b]

        # Admin sees both
        _as(a, role="admin")
        rows = get_patients_by_date("2026-01-01")
        assert {r["id"] for r in rows} >= {id_a, id_b}

        # No user context (internal/background) -> unscoped
        set_current_user(None)
        rows = get_patients_by_date("2026-01-01")
        assert {r["id"] for r in rows} >= {id_a, id_b}
    finally:
        set_current_user(None)
        _cleanup(["SCOPEA1", "SCOPEB1"])


def test_admin_scope_mine_sees_only_own():
    from server.utils.current_user import restrict_admin_scope

    a, b = create_user("scope_mine_a"), create_user("scope_mine_b")
    try:
        id_a = _save("SCOPMINE1", a)
        id_b = _save("SCOPMINE2", b)

        # Admin with ?scope=mine -> scoped like a clinician
        _as(a, role="admin")
        with restrict_admin_scope("mine"):
            rows = get_patients_by_date("2026-01-01")
            assert [r["id"] for r in rows] == [id_a]

        # Same admin without the override still sees both
        rows = get_patients_by_date("2026-01-01")
        assert {r["id"] for r in rows} >= {id_a, id_b}

        # Clinician is scoped regardless of the flag
        _as(b)
        with restrict_admin_scope("mine"):
            rows = get_patients_by_date("2026-01-01")
            assert [r["id"] for r in rows] == [id_b]
    finally:
        set_current_user(None)
        _cleanup(["SCOPMINE1", "SCOPMINE2"])


def test_write_stamps_created_by():
    a = create_user("stamp_a")
    try:
        note_id = _save("STAMPA1", a)
        with get_db().read() as cursor:
            cursor.execute("SELECT created_by FROM encounters WHERE id = ?", (note_id,))
            assert cursor.fetchone()["created_by"] == a
    finally:
        set_current_user(None)
        _cleanup(["STAMPA1"])


def test_todos_per_user():
    a, b = create_user("todo_a"), create_user("todo_b")
    try:
        _as(a)
        add_todo_item("A's task")
        _as(b)
        add_todo_item("B's task")

        assert [t["task"] for t in get_todo_items()] == ["B's task"]
        _as(a)
        assert [t["task"] for t in get_todo_items()] == ["A's task"]
    finally:
        set_current_user(None)
        with get_db().transaction() as cursor:
            cursor.execute("DELETE FROM todos WHERE task IN ('A''s task', 'B''s task')")


def test_custom_templates_scoped_but_system_shared():
    from server.database.repositories.templates import (
        get_template_by_key,
        save_template,
    )
    from server.schemas.templates import ClinicalTemplate, TemplateField

    a, b = create_user("tpl_a"), create_user("tpl_b")
    key = "custom_testownership_1"
    try:
        _as(a)
        save_template(
            ClinicalTemplate(
                template_key=key,
                template_name="Owned",
                fields=[
                    TemplateField(
                        field_key="x",
                        field_name="X",
                        field_type="text",
                        system_prompt="Fill in X",
                        style_example="some example",
                    )
                ],
            )
        )

        _as(b)
        assert get_template_by_key(key) is None  # A's custom is invisible to B

        # System/protected templates stay shared
        assert get_template_by_key("phlox_01") is not None
    finally:
        set_current_user(None)
        with get_db().transaction() as cursor:
            cursor.execute("DELETE FROM clinical_templates WHERE template_key = ?", (key,))


def test_claim_leaves_seeded_letter_templates_shared():
    """First-run claim must not swallow the shared letter templates: every
    new user's onboarding needs them as picker options."""
    from server.database.repositories.letter import get_letter_templates
    from server.database.repositories.users import claim_unowned

    a, b = create_user("claim_a"), create_user("claim_b")
    try:
        _as(a)
        claim_unowned(a)

        # A (the claimer) and B (a later user) both still see letter templates
        names_a = {t["name"] for t in get_letter_templates()}
        _as(b)
        names_b = {t["name"] for t in get_letter_templates()}
        assert names_a, "claimer sees no letter templates"
        assert names_a == names_b, "letter templates not shared after claim"
    finally:
        set_current_user(None)
