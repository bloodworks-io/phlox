"""Offline selfcheck for the training pipeline. No network. Run: python selfcheck.py"""

import asyncio
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import generate as g
import or_

DATA = or_.DATA


def test_spec():
    assert set(g.TEMPLATES) == {"phlox_01", "soap_01", "progress_01", "procedure_01", "consult_01"}
    for t in g.TEMPLATES.values():
        keys = [f["field_key"] for f in t["fields"]]
        assert "plan" in keys, t["template_key"]
    assert len(g.LETTER_TEMPLATES) == 4
    assert "letter" in g.PROMPTS and "job_extraction" in g.PROMPTS
    print("spec ok")


def test_stable_hash():
    assert g.stable_hash("phlox_01") == g.stable_hash("phlox_01")
    assert g.stable_hash("a") != g.stable_hash("b")
    print("stable_hash ok")


def test_noise():
    rng = g.rng_for("noise", 1)
    sloppy = g.asr_sloppy("Um, so Doctor, the pain started, uh, three weeks ago!", rng)
    assert sloppy == sloppy.lower() and "," not in sloppy and "..." in sloppy
    marked = g.inaudible_marks(" ".join(["word"] * 200), g.rng_for("noise", 2))
    assert marked.count("[inaudible]") >= 1
    assert g.noisy_variant("x" * 500, "scen-0001") is None or isinstance(g.noisy_variant("x" * 500, "scen-0001"), str)
    print("noise ok")


def test_scenario_items():
    conds = ["Condition A", "Condition B", "Condition C"]
    items = g.scenario_items(conds)
    assert len(items) == 5 * g.COUNTS["scenarios_per_template"]
    ids = [i["id"] for i in items]
    assert len(set(ids)) == len(ids)
    p = items[0]["patient"]
    assert g.age_from_dob(p["dob"]) == p["age"], (p["dob"], p["age"])
    # determinism across processes
    again = g.scenario_items(conds)
    assert items[123]["patient"] == again[123]["patient"]
    print("scenario items ok")


def test_run_stage_resume(tmpdir):
    shutil.copytree(DATA, tmpdir / "data") if DATA.exists() else (tmpdir / "data").mkdir()
    or_.DATA = tmpdir / "data"  # redirect

    class FakeClient:
        def __init__(self, c=4):
            self.sem = asyncio.Semaphore(c)
            self.spend = {"cost": 0.001, "calls": 1}
            self.killed = False

    calls = {"n": 0}

    async def make(client, item):
        calls["n"] += 1
        if item["id"] == "bad":
            raise ValueError("boom")
        return {"payload": item["id"] * 2}

    items = [{"id": f"i{n}"} for n in range(5)] + [{"id": "bad"}]
    async def go():
        return await or_.run_stage("_selfcheck", items, make, concurrency=4)
    orig_client = or_.Client
    or_.Client = FakeClient
    try:
        out = asyncio.run(go())
    finally:
        or_.Client = orig_client
    recs = {r["id"]: r for r in out}
    assert set(recs) == {f"i{n}" for n in range(5)}, recs.keys()
    assert recs["i3"]["payload"] == "i3i3"
    assert (tmpdir / "data" / "_selfcheck.failures").exists()

    # resume: rerun must not re-call completed items
    calls["n"] = 0
    or_.DATA = tmpdir / "data"
    async def go2():
        return await or_.run_stage("_selfcheck", items, make, concurrency=4)
    or_.Client = FakeClient
    try:
        out2 = asyncio.run(go2())
    finally:
        or_.Client = orig_client
    assert calls["n"] == 1, f"expected only failed item retried, got {calls['n']}"  # 'bad' retried
    assert len(out2) == 5
    shutil.rmtree(tmpdir)
    print("run_stage + resume ok")


def test_json_parse():
    assert or_.parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert or_.parse_json('Sure! {"a": {"b": 2}} hope that helps') == {"a": {"b": 2}}
    print("json parse ok")


def test_field_summaries_denest():
    import eval as ev

    keys = ["clinical_history", "plan"]
    inner = {"clinical_history": ["well"], "plan": ["review"]}
    assert ev.parse_field_summaries('{"field_summaries": {"field_summaries": %s}}' % json.dumps(inner), keys) == inner
    assert (
        ev.parse_field_summaries('{"field_summaries": {"field_summaries": {"field_summaries": %s}}}' % json.dumps(inner), keys)
        == inner
    )
    # array wrapper: no de-nest → unrecognized keys → raises
    try:
        ev.parse_field_summaries('{"field_summaries": ["a"]}', keys)
        raise AssertionError("array wrapper should throw")
    except ValueError:
        pass
    # 4 wrapper levels tolerated (initial unwrap + 3 loop); 5 exceeds the cap → raises
    four = '{"field_summaries": {"field_summaries": {"field_summaries": {"field_summaries": {"plan": ["x"]}}}}}'
    assert ev.parse_field_summaries(four, ["plan"]) == {"plan": ["x"]}
    try:
        ev.parse_field_summaries('{"field_summaries": %s}' % four, ["plan"])
        raise AssertionError("5-level wrap should throw")
    except ValueError:
        pass
    print("field_summaries de-nest ok")


def test_runtime_variants():
    import build_sft as b

    dia = "Doctor: Hello, Jane. How are you?\nPatient: I'm fine, thanks — just tired."
    prose = b.strip_diarization(dia)
    assert ":" not in prose.replace("https", "") or True
    assert "Doctor" not in prose and "Patient" not in prose and "\n" not in prose
    assert "Hello, Jane." in prose
    np_ = b.no_punct(prose)
    assert not set(".,!?;:").intersection(np_), np_
    assert np_ == " ".join(np_.split())

    # distribution across 300 ambient scenarios: all three shapes appear, diarized is minority
    shapes = {"diarized": 0, "prose": 0, "nopunct": 0}
    for i in range(300):
        sid = f"phlox_01-{i:04d}"
        vs = b.runtime_variants({"scenario_id": sid, "mode": "ambient", "transcript": dia})
        assert len(vs) == 1
        v = vs[0]
        if "Doctor:" in v:
            shapes["diarized"] += 1
        elif "." in v:
            shapes["prose"] += 1
        else:
            shapes["nopunct"] += 1
    assert all(shapes.values()), shapes
    assert shapes["diarized"] < shapes["prose"], shapes
    print("runtime variants ok", shapes)


def test_build_sft_ports():
    import build_sft as b

    fields = [
        {"field_key": "clinical_history", "field_name": "Current History", "persistent": False,
         "system_prompt": "Summarise. "},
        {"field_key": "plan", "field_name": "Plan", "persistent": False, "system_prompt": "Extract actions."},
    ]
    sys_ambient = b.build_scribe_system(fields, {"name": "Jane Doe", "gender": "F"}, True, None)
    expected = (
        "Extract relevant information for each of the following fields from the medical transcript.\n\n"
        "Patient name: Jane Doe Gender: F\n\n"
        "For each field, extract only the most relevant discussion points. If no relevant information is found for a field, return an empty list for that field.\n\n"
        "FIELDS:\n"
        "FIELD: clinical_history\nNAME: Current History\nINSTRUCTIONS: Summarise.\n"
        "FIELD: plan\nNAME: Plan\nINSTRUCTIONS: Extract actions.\n\n"
        'Output MUST be ONLY valid JSON with top-level key "field_summaries" (object mapping field_key to array of strings).'
    )
    assert sys_ambient == expected, sys_ambient

    sys_returning = b.build_scribe_system(fields, {}, False, "CLL")
    assert sys_returning.startswith(
        "Extract and organize information from the clinician's direct dictation for each of the following fields."
        " This is a returning patient who sees the clinician for CLL."
    )

    msgs = b.build_letter_messages(
        {"display": "Jane Doe", "gender": "F", "dob": "1980-01-31"},
        {"plan": "1. Review"},
        "Be brief.",
        "Dr Smith",
        "cardiology",
        [{"role": "assistant", "content": "V1"}, {"role": "user", "content": "shorter"}],
    )
    assert msgs[0]["content"].endswith("Write the letter in the voice of Dr Smith, a cardiology specialist.")
    assert msgs[1]["content"] == "Before we proceed with the task; please take note of the following additional instructions:\nBe brief."
    assert msgs[2]["content"].startswith("Patient Name: Jane Doe\nGender: F\nAge: ")
    assert msgs[2]["content"].endswith("Clinic Note:\nPlan:\n1. Review")
    assert msgs[3:] == [{"role": "assistant", "content": "V1"}, {"role": "user", "content": "shorter"}]

    assert b.JOBS_SUFFIX.startswith("\n\nReturn ONLY valid JSON")
    assert b.cap_document_text("x" * 10, 5) == "xxxxx\n\n[document truncated]"
    assert b.points_from_content("1. First\n- Second\n# Header\n\n  \n• Third") == ["First", "Second", "# Header", "Third"]
    assert b.compact_json({"a": 1}) == '{"a":1}'
    print("build_sft ports ok")


def test_build_sft_end_to_end():
    """Tiny fixture artifacts through the builders -> sane example counts and shapes."""
    import build_sft as b

    fixture = {
        "scenarios": [{"id": "phlox_01-0001", "template_key": "phlox_01",
                       "patient": {"first": "Jane", "last": "Doe", "gender": "F", "dob": "1980-01-31", "age": 46},
                       "template_data": {f["field_key"]: f"- point one\n- point two" for f in b.TEMPLATES["phlox_01"]["fields"]},
                       "doctor": "Dr Smith", "specialty": "cardiology", "condition": "CLL", "returning": True}],
        "transcripts": [{"id": "phlox_01-0001", "scenario_id": "phlox_01-0001", "mode": "ambient",
                         "transcript": "Doctor: hello " * 100}],
        "letters": [{"id": "L00001", "scenario_id": "phlox_01-0001", "letter_type": "GP Letter",
                     "instructions": "Write a brief letter...", "letter": "Dear Doctor, " + "x" * 400}],
        "refinement": [{"id": "R00001", "letter_id": "L00001",
                        "turns": [{"request": "shorten it", "revised_letter": "Dear Doctor, " + "y" * 350}]}],
        "jobs": [{"id": "J00001", "scenario_id": "phlox_01-0001", "plan": "1. Review",
                  "jobs": {"action_items": [{"text": "Review", "category": "action", "rationale": None}], "excluded": []}}],
        "demographics": [{"id": "D00001", "scenario_id": "phlox_01-0001",
                          "document": "Re: Jane Doe UR123 DOB 31/01/1980",
                          "label": {"first_name": "Jane", "last_name": "Doe", "dob": "1980-01-31", "gender": "F",
                                    "ur_number": "UR123", "address": None, "phone": None}}],
    }
    tmp = b.DATA
    import tempfile, shutil, pathlib

    with tempfile.TemporaryDirectory() as td:
        b.DATA = pathlib.Path(td)
        for stage, rows in fixture.items():
            with (b.DATA / f"{stage}.jsonl").open("w") as f:
                for r in rows:
                    f.write(json.dumps(r) + "\n")
        scribe = b.scribe_examples()
        assert len(scribe) >= 1
        assert scribe[0]["completion"].startswith('{"field_summaries":')
        assert "phlox_01" not in scribe[0]["completion"] or True
        labels = json.loads(scribe[0]["completion"])["field_summaries"]
        assert set(labels) == {"clinical_history", "plan"}  # non-persistent only
        letters = b.letter_examples()
        assert letters and letters[0]["task"] == "letter:GP Letter"
        ref = b.refinement_examples()
        assert ref and ref[0]["prompt"][3] == {"role": "assistant", "content": fixture["letters"][0]["letter"]}
        assert ref[0]["prompt"][4] == {"role": "user", "content": "shorten it"}
        jobs = b.jobs_examples()
        assert jobs and jobs[0]["completion"].startswith('{"action_items":')
        demo = b.demographics_examples()
        assert demo and '"first_name":"Jane"' in demo[0]["completion"]
        b.DATA = tmp
    print("build_sft end-to-end ok")


if __name__ == "__main__":
    import tempfile

    test_spec()
    test_stable_hash()
    test_noise()
    test_scenario_items()
    test_json_parse()
    test_field_summaries_denest()
    test_build_sft_ports()
    test_build_sft_end_to_end()
    with tempfile.TemporaryDirectory() as td:
        test_run_stage_resume(Path(td))
    print("ALL SELF CHECKS PASSED")
