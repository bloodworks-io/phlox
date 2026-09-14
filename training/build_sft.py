"""Assemble the SFT dataset from burn artifacts.

Output: training/data/sft_train.jsonl + sft_dev.jsonl, one example per line:
  {"task": "...", "prompt": [{"role": "...", "content": "..."}], "completion": [{"role": "assistant", "content": "..."}]}

All prompt builders are verbatim ports of the runtime code (scribe.ts, letter.ts,
router.ts) — that verbatim-ness is what makes the fine-tune a drop-in. selfcheck.py
pins the ports against golden strings.
"""

from __future__ import annotations

import json
import random
import re
from pathlib import Path

DATA = Path(__file__).parent / "data"
SPEC = json.loads((DATA / "spec.json").read_text())
TEMPLATES = {t["template_key"]: t for t in SPEC["templates"]}
PROMPTS = SPEC["prompts"]


# ---------- ports (verbatim) ----------

def title_case_key(key: str) -> str:
    return re.sub(r"_", " ", key).title()


def calculate_age(dob: str | None) -> str:
    if not dob:
        return "N/A"
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", dob.strip())
    if not m:
        return "N/A"
    from datetime import date

    y, mo, d = int(m[1]), int(m[2]), int(m[3])
    today = date.today()
    age = today.year - y - ((today.month, today.day) < (mo, d))
    return str(age)


def build_patient_context(ctx: dict) -> str:
    parts = []
    if ctx.get("name"):
        parts.append(f"Patient name: {ctx['name']}")
    if ctx.get("age"):
        parts.append(f"Age: {ctx['age']}")
    if ctx.get("gender"):
        parts.append(f"Gender: {ctx['gender']}")
    if ctx.get("dob"):
        parts.append(f"DOB: {ctx['dob']}")
    return " ".join(parts)


def build_scribe_system(fields, patient_ctx, is_ambient, primary_condition, intro_override=None) -> str:
    field_instructions = "\n".join(
        f"FIELD: {f['field_key']}\nNAME: {f['field_name']}\nINSTRUCTIONS: {(f.get('system_prompt') or '').strip()}"
        for f in fields
    )
    patient_context_str = build_patient_context(patient_ctx)
    intro = intro_override or (
        "Extract relevant information for each of the following fields from the medical transcript."
        if is_ambient
        else "Extract and organize information from the clinician's direct dictation for each of the following fields."
    )
    intro_suffix = f" This is a returning patient who sees the clinician for {primary_condition}." if primary_condition else ""
    return (
        f"{intro}{intro_suffix}\n\n"
        f"{patient_context_str}\n\n"
        'For each field, extract only the most relevant discussion points. If no relevant information is found for a field, return an empty list for that field.\n\n'
        f"FIELDS:\n{field_instructions}\n\n"
        'Output MUST be ONLY valid JSON with top-level key "field_summaries" (object mapping field_key to array of strings).'
    )


def letter_system(doctor: str | None, specialty: str | None) -> str:
    system = PROMPTS["letter"]["system"]
    if doctor or specialty:
        voice = "Write the letter in the voice of "
        voice += f"{doctor}, " if doctor else ""
        voice += f"a {specialty} specialist." if specialty else "a specialist."
        system += f"\n\n{voice}"
    return system


def clinic_note(template_data: dict) -> str:
    return "\n\n".join(
        f"{title_case_key(k)}:\n{v}" for k, v in template_data.items() if v
    )


def build_letter_messages(patient, template_data, additional_instruction, doctor, specialty, context=None):
    """Mirrors letter.ts:45-84 (system [+voice], optional instruction msg, patient+note msg, last-8 context)."""
    msgs = [{"role": "system", "content": letter_system(doctor, specialty)}]
    if additional_instruction:
        msgs.append({
            "role": "user",
            "content": f"Before we proceed with the task; please take note of the following additional instructions:\n{additional_instruction}",
        })
    msgs.append({
        "role": "user",
        "content": (
            f"Patient Name: {patient['display']}\nGender: {patient['gender']}\nAge: {calculate_age(patient['dob'])}\n\n"
            f"Clinic Note:\n{clinic_note(template_data)}"
        ),
    })
    msgs += [m for m in (context or []) if m.get("role") != "system"][-8:]
    return msgs


JOBS_SUFFIX = (
    "\n\nReturn ONLY valid JSON with this top-level shape:\n"
    '{"action_items": [{"text": "...", "category": "action", "rationale": "..."}], "excluded": [{"text": "...", "category": "follow_up", "rationale": "..."}]}'
)

DEMOGRAPHICS_SYSTEM = (
    "Extract the patient's demographic details from the provided document text. "
    "Return ONLY valid JSON with these keys: "
    "first_name, last_name, dob (ISO YYYY-MM-DD when determinable), "
    "gender (single letter 'M' or 'F' when stated), ur_number, address, phone. "
    "Use null for any field not present in the document. Do not guess or infer."
)


def cap_document_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}\n\n[document truncated]"


# ---------- label helpers ----------

def points_from_content(content: str) -> list[str]:
    """Field content -> array of single-line points (inverse of formatPoints; keeps '#' header style)."""
    points = []
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        line = re.sub(r"^\d+\.\s*", "", line)
        line = re.sub(r"^[•\-*]\s+", "", line)
        if line:
            points.append(line)
    return points


def strip_diarization(text: str) -> str:
    text = re.sub(r"^\s*(Doctor|Patient|Dr\.?)\s*:\s*", "", text, flags=re.M)
    return re.sub(r"\s+", " ", text).strip()


def no_punct(text: str) -> str:
    text = re.sub(r"[.,!?;:\u2014\u2019]+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def runtime_variants(tr: dict) -> list[str]:
    """Mirror the demo's whisper-wasm ASR: ONE plain blob, no diarization, punctuation
    optional (tiny.en drops it). Diarized minority kept for server parity. Deterministic."""
    import generate as g

    rng = random.Random(f"var:{tr['scenario_id']}")
    text = tr["transcript"]
    prose = strip_diarization(text) if tr["mode"] == "ambient" else re.sub(r"\s+", " ", text).strip()
    roll = rng.random()
    if tr["mode"] == "dictation":
        if roll < 0.6:
            return [text]
        if roll < 0.9:
            return [no_punct(prose)]
        return [g.inaudible_marks(no_punct(prose), rng)]
    if roll < 0.2:
        return [text]
    if roll < 0.65:
        return [prose]
    if roll < 0.9:
        return [no_punct(prose)]
    return [g.inaudible_marks(no_punct(prose), rng)]


def compact_json(obj) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


# ---------- example builders ----------

def load(stage: str) -> list[dict]:
    path = DATA / f"{stage}.jsonl"
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()]


def scribe_examples():
    """transcript -> field_summaries JSON for non-persistent fields (runtime ASR variants applied)."""
    out = []
    variants = {}
    transcript_mode = {t["scenario_id"]: t["mode"] for t in load("transcripts")}
    for t in load("transcripts"):
        variants.setdefault(t["scenario_id"], []).extend(runtime_variants(t))
    for scen in load("scenarios"):
        sid = scen["id"]
        for transcript in variants.get(sid, []):
            template = TEMPLATES[scen["template_key"]]
            targets = [f for f in template["fields"] if not f["persistent"]]
            p = scen["patient"]
            ctx = {"name": f"{p['first']} {p['last']}", "dob": p["dob"], "gender": p["gender"]}
            rng = random.Random(f"pri:{sid}")
            primary_condition = scen.get("condition") if rng.random() < 0.4 else None
            is_ambient = transcript_mode.get(sid, "ambient") == "ambient"
            prompt = [
                {"role": "system", "content": build_scribe_system(targets, ctx, is_ambient, primary_condition)},
                {"role": "user", "content": transcript},
            ]
            label = {f["field_key"]: points_from_content(scen["template_data"][f["field_key"]]) for f in targets}
            completion = compact_json({"field_summaries": label})
            out.append({"task": f"scribe:{scen['template_key']}", "prompt": prompt, "completion": completion})
        # document-from-text variant for ~1 in 10 scenarios (introOverride path)
        rng = random.Random(f"docvar:{sid}")
        if rng.random() < 0.1:
            template = TEMPLATES[scen["template_key"]]
            targets = [f for f in template["fields"] if not f["persistent"]]
            p = scen["patient"]
            ctx = {"name": f"{p['first']} {p['last']}", "dob": p["dob"], "gender": p["gender"]}
            doc = cap_document_text(clinic_note(scen["template_data"])[:6000], 12000)
            intro = "Extract relevant information for each field from the provided medical document."
            prompt = [
                {"role": "system", "content": build_scribe_system(targets, ctx, False, None, intro_override=intro)},
                {"role": "user", "content": doc},
            ]
            label = {f["field_key"]: points_from_content(scen["template_data"][f["field_key"]]) for f in targets}
            out.append({"task": f"scribe_doc:{scen['template_key']}", "prompt": prompt, "completion": compact_json({"field_summaries": label})})
    return out


def letter_examples():
    out = []
    scen_by_id = {s["id"]: s for s in load("scenarios")}
    for l in load("letters"):
        scen = scen_by_id.get(l["scenario_id"])
        if not scen:
            continue
        p = scen["patient"]
        patient = {"display": f"{p['first']} {p['last']}", "gender": p["gender"], "dob": p["dob"]}
        if l["letter_type"] == "dictation":
            spoken = " ".join(v for v in scen["template_data"].values())
            td = {**scen["template_data"], "Dictation": spoken[:2000]}
        else:
            td = scen["template_data"]
        rng = random.Random(f"lvoice:{l['id']}")
        doctor = scen.get("doctor") if rng.random() < 0.7 else None  # settings sometimes carry no name
        specialty = scen.get("specialty") if rng.random() < 0.8 else None
        prompt = build_letter_messages(patient, td, l["instructions"], doctor, specialty)
        out.append({"task": f"letter:{l['letter_type']}", "prompt": prompt, "completion": l["letter"]})
    return out


def refinement_examples():
    """Multi-turn episodes: one example per turn, context grows exactly like useLetter.refineLetter."""
    out = []
    letters = {l["id"]: l for l in load("letters")}
    scen_by_id = {s["id"]: s for s in load("scenarios")}
    for r in load("refinement"):
        letter = letters.get(r["letter_id"])
        if not letter:
            continue
        scen = scen_by_id.get(letter["scenario_id"])
        if not scen:
            continue
        p = scen["patient"]
        patient = {"display": f"{p['first']} {p['last']}", "gender": p["gender"], "dob": p["dob"]}
        base_context = [{"role": "assistant", "content": letter["letter"]}]
        context = list(base_context)
        for turn in r["turns"]:
            context = context + [{"role": "user", "content": turn["request"]}]
            prompt = build_letter_messages(patient, scen["template_data"], letter["instructions"],
                                            scen.get("doctor"), scen.get("specialty"), context)
            out.append({"task": "letter_refine", "prompt": prompt, "completion": turn["revised_letter"]})
            context = context + [{"role": "assistant", "content": turn["revised_letter"]}]
    return out


def jobs_examples():
    return [
        {
            "task": "jobs",
            "prompt": [
                {"role": "system", "content": PROMPTS["job_extraction"]["system"] + JOBS_SUFFIX},
                {"role": "user", "content": j["plan"]},
            ],
            "completion": compact_json(j["jobs"]),
        }
        for j in load("jobs")
    ]


def demographics_examples():
    out = []
    for d in load("demographics"):
        prompt = [
            {"role": "system", "content": DEMOGRAPHICS_SYSTEM},
            {"role": "user", "content": cap_document_text(d["document"], 3000) or "(no text)"},
        ]
        out.append({"task": "demographics", "prompt": prompt, "completion": compact_json(d["label"])})
    return out


def hf_examples():
    out = []
    template = TEMPLATES["soap_01"]
    targets = [f for f in template["fields"] if not f["persistent"]]
    for h in load("hf"):
        prompt = [
            {"role": "system", "content": build_scribe_system(targets, {}, True, None)},
            {"role": "user", "content": h.get("transcript", "")},
        ]
        out.append({"task": "scribe:soap_01_hf", "prompt": prompt, "completion": compact_json({"field_summaries": h["field_summaries"]})})
    return out


def main():
    all_examples = []
    for name, fn in [
        ("scribe", scribe_examples),
        ("letters", letter_examples),
        ("refinement", refinement_examples),
        ("jobs", jobs_examples),
        ("demographics", demographics_examples),
        ("hf", hf_examples),
    ]:
        ex = fn()
        print(f"{name}: {len(ex)} examples")
        all_examples.extend(ex)
    rng = random.Random("split:1")
    rng.shuffle(all_examples)
    by_task = {}
    for e in all_examples:
        by_task.setdefault(e["task"].split(":")[0], []).append(e)
    dev, train = [], []
    for task, exs in sorted(by_task.items()):
        k = max(1, round(len(exs) * 0.05))
        rng.shuffle(exs)
        dev.extend(exs[:k])
        train.extend(exs[k:])
    for name, rows in (("sft_train", train), ("sft_dev", dev)):
        path = DATA / f"{name}.jsonl"
        with path.open("w") as f:
            for e in rows:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")
        print(f"{name}: {len(rows)} -> {path}")
    print("tasks:", {t: len(v) for t, v in sorted(by_task.items())})


if __name__ == "__main__":
    main()
