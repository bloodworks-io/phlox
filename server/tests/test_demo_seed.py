"""Guards for the hand-authored demo seed data.

The showcase patient's citations are maintained by hand — these tests keep
future transcript or field edits from silently breaking the demo (indices,
snapshots, line counts, verdict rules, persistent-field exclusion).
"""

import json
import re
from pathlib import Path

from server.database.config.defaults.templates import DefaultTemplates

DEMO_DIR = Path(__file__).resolve().parent.parent / "demo"
SPEAKER_LINE = re.compile(r"^(S[1-9]\d*|S\?):\s")


def _patients():
    with (DEMO_DIR / "example_patients.json").open() as f:
        return json.load(f)["patients"]


def _persistent_field_keys(template_key):
    for template in DefaultTemplates.get_default_templates():
        if template["template_key"] == template_key:
            return {f["field_key"] for f in template["fields"] if f.get("persistent")}
    raise AssertionError(f"template {template_key} not found")


def test_all_demo_transcripts_are_labelled_dialogue():
    patients = _patients()
    assert len(patients) == 20
    for patient in patients:
        lines = patient["transcript"].split("\n")
        assert len(lines) > 1, f"{patient['name']}: transcript is not multi-line"
        for line in lines:
            assert SPEAKER_LINE.match(line), f"{patient['name']}: unlabelled line {line!r}"


def test_showcase_citations_respect_all_invariants():
    patient = _patients()[0]
    envelope = patient["note_citations"]
    template_data = {
        "primary_history": patient["primary_history"],
        "additional_history": patient["oahp"],
        "investigations": patient["investigations"],
        "clinical_history": patient["clinical_history"],
        "impression": patient["impression"],
        "plan": patient["plan"],
    }
    transcript_lines = patient["transcript"].split("\n")

    assert envelope["transcript_line_count"] == len(transcript_lines)
    assert envelope["resolved"] == []

    persistent = _persistent_field_keys("phlox_01")
    assert set(envelope["fields"]) <= set(template_data) - persistent, (
        "ambient grounding covers non-persistent fields only"
    )

    verdicts = []
    for field_key, citations in envelope["fields"].items():
        field_lines = template_data[field_key].split("\n")
        for citation in citations:
            # Snapshot must be an exact line of the field, at its stated index.
            assert citation["text"] == field_lines[citation["line_index"]]
            # Cited transcript indices exist.
            for index in [*citation["sources"], *citation["contradicts"]]:
                assert 0 <= index < len(transcript_lines)
            # Verdict rules hold.
            if citation["contradicts"]:
                assert citation["verdict"] == "conflict"
            elif citation["sources"]:
                assert citation["verdict"] == "supported"
            else:
                assert citation["verdict"] == "unverified"
            verdicts.append(citation["verdict"])

    # The showcase demonstrates every verdict, including the planted
    # hallucination (unverified) and the planted howler (conflict).
    assert set(verdicts) == {"supported", "unverified", "conflict"}


def test_only_showcase_patient_carries_citations():
    patients = _patients()
    for index, patient in enumerate(patients):
        if index == 0:
            assert "note_citations" in patient
        else:
            assert "note_citations" not in patient
