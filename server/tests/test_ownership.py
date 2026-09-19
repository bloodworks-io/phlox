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


def _drop_users(usernames: list[str]):
    with get_db().transaction() as cursor:
        for name in usernames:
            cursor.execute("DELETE FROM users WHERE username = ?", (name,))


def test_cross_user_writes_are_scoped_out():
    """Every encounter write path must filter by owner, not bare id."""
    import json as _json

    from server.database.repositories.encounter import (
        update_patient_reasoning,
        update_patient_summary,
    )
    from server.database.repositories.jobs import update_patient_jobs_list
    from server.database.repositories.letter import update_patient_letter

    _drop_users(["pt_write_a", "pt_write_b"])  # leftovers from prior runs
    a, b = create_user("pt_write_a"), create_user("pt_write_b")
    try:
        id_a = _save("PTWRITEA1", a)
        _save("PTWRITEB1", b)

        # B attempts every encounter write against A's record
        _as(b)
        update_patient_reasoning(id_a, {"hacked": True})
        update_patient_summary(id_a, "stolen summary", "stolen condition")
        update_patient_letter(id_a, "stolen letter")
        update_patient_jobs_list(id_a, [{"task": "steal", "completed": True}])

        # None of them landed on A's row
        set_current_user(None)
        with get_db().read() as cursor:
            cursor.execute(
                "SELECT reasoning_output, encounter_summary, primary_condition, "
                "final_letter, jobs_list FROM encounters WHERE id = ?",
                (id_a,),
            )
            row = cursor.fetchone()
        assert row["reasoning_output"] in (None, "")
        assert row["encounter_summary"] in (None, "")
        assert row["primary_condition"] in (None, "")
        assert row["final_letter"] in (None, "")
        assert _json.loads(row["jobs_list"] or "[]") == []

        # The owner's writes still apply
        _as(a)
        update_patient_reasoning(id_a, {"plan": "rest"})
        update_patient_summary(id_a, "legit summary", "legit condition")
        update_patient_letter(id_a, "legit letter")
        update_patient_jobs_list(id_a, [{"task": "follow-up", "completed": True}])

        set_current_user(None)
        with get_db().read() as cursor:
            cursor.execute(
                "SELECT reasoning_output, encounter_summary, final_letter, jobs_list "
                "FROM encounters WHERE id = ?",
                (id_a,),
            )
            row = cursor.fetchone()
        assert "rest" in row["reasoning_output"]
        assert row["encounter_summary"] == "legit summary"
        assert row["final_letter"] == "legit letter"
        assert "follow-up" in row["jobs_list"]

        # Background context (no user) remains unrestricted by design
        update_patient_reasoning(id_a, {"bg": True})
        with get_db().read() as cursor:
            cursor.execute("SELECT reasoning_output FROM encounters WHERE id = ?", (id_a,))
            assert "bg" in cursor.fetchone()["reasoning_output"]
    finally:
        set_current_user(None)
        _cleanup(["PTWRITEA1", "PTWRITEB1"])
        _drop_users(["pt_write_a", "pt_write_b"])
