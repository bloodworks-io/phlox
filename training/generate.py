"""Synthetic data generation for Phlox fine-tune. Stages run resumably via or.py.

  conditions    one teacher call -> ~200 condition entities (cached)
  scenarios     gold notes: full template_data per patient encounter
  transcripts   gold note -> ambient dialogue / dictation (+ client-side ASR noise)
  letters       note -> exemplar letters (4 types + dictation polish)
  refinement    letter -> 1-3 turn doctor edit episodes (full replacement letters)
  jobs          plan -> action-items JSON (production shape)
  demographics  teacher writes doc snippet; label known from patient by construction
  hf            optional: BeTraC transcripts -> teacher-labeled SOAP extraction
  all           run everything in order
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import random
import re
from datetime import date, timedelta
from pathlib import Path

import or_

DATA = or_.DATA
SPEC = json.loads((DATA / "spec.json").read_text())
TEMPLATES = {t["template_key"]: t for t in SPEC["templates"]}
PROMPTS = SPEC["prompts"]
LETTER_TEMPLATES = SPEC["letterTemplates"]

COUNTS = {
    "scenarios_per_template": 2000,
    "letters": 2500,
    "refinement": 3000,
    "jobs": 1200,
    "demographics": 800,
    "hf": 1500,
}

FIRST_NAMES_F = "Mary Patricia Jennifer Linda Elizabeth Barbara Susan Jessica Sarah Karen Nancy Lisa Margaret Betty Sandra Ashley Kimberly Emily Donna Michelle Carol Amanda Dorothy Melissa Deborah Stephanie Rebecca Sharon Laura Cynthia Kathleen Amy Angela Shirley Anna Brenda Pamela Emma Nicole Helen Samantha Katherine Christine Debra Rachel Carolyn Janet Catherine Maria Heather Diane Ruth Julie Olivia Joyce Virginia Victoria Kelly Lauren Christina Joan Evelyn Judith Megan Andrea Cheryl".split()
FIRST_NAMES_M = "James John Robert Michael William David Richard Joseph Thomas Charles Christopher Daniel Matthew Anthony Mark Donald Steven Paul Andrew Joshua Kenneth Kevin Brian George Timothy Ronald Jason Edward Jeffrey Ryan Jacob Gary Nicholas Eric Jonathan Stephen Larry Justin Scott Brandon Benjamin Samuel Gregory Frank Alexander Raymond Patrick Jack Dennis Jerry Tyler Aaron Jose Adam Nathan Henry Douglas Zachary Peter Kyle Noah Ethan Jeremy Walter Christian Keith Roger Terry Austin Sean Gerald Carl Harold Dylan Arthur Lawrence Jordan Jesse Bryan Billy Bruce Gabriel Joe Logan Alan Juan Albert Willie Elijah Wayne Randy Vincent Mason Roy Ralph Bobby Russell Bradley Philip Eugene".split()
SURNAMES = "Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez Hernandez Lopez Gonzalez Wilson Anderson Thomas Taylor Moore Jackson Martin Lee Perez Thompson White Harris Sanchez Clark Ramirez Lewis Robinson Walker Young Allen King Wright Scott Torres Nguyen Hill Flores Green Adams Nelson Baker Hall Rivera Campbell Mitchell Carter Roberts Gomez Phillips Evans Turner Diaz Parker Cruz Edwards Collins Reyes Stewart Morris Morales Murphy Cook Rogers Gutierrez Ortiz Morgan Cooper Peterson Bailey Reed Kelly Howard Ramos Kim Cox Ward Richardson Watson Brooks Chavez Wood James Bennett Gray Mendoza Ruiz Hughes Price Alvarez Castillo Sanders Patel Myers Long Ross Foster Jimenez".split()
SPECIALTIES = "haematology oncology cardiology respiratory endocrinology gastroenterology nephrology neurology rheumatology dermatology general medicine geriatrics infectious diseases psychiatry palliative care vascular surgery orthopaedics urology gynaecology ophthalmology ENT emergency medicine rehabilitation pain medicine".split()

REFINEMENT_POOL = [
    "shorten the letter by about a third",
    "expand on the investigation findings",
    "make the tone more formal",
    "make the tone warmer and less clinical",
    "state the medication doses explicitly",
    "remove the family history section",
    "add a sentence thanking the GP for the referral",
    "make the follow-up plan more prominent",
    "simplify the jargon so a lay reader can follow it",
    "reorder so the diagnosis comes first",
    "remove any identifying patient details from the body",
    "add the patient's recent blood results as a short table-like list",
    "tighten the opening paragraph",
    "mention the procedure complications briefly",
    "close with an offer for the GP to call if concerns arise",
]


def stable_hash(s: str) -> int:
    return int(hashlib.sha256(s.encode()).hexdigest()[:8], 16)


def rng_for(stage: str, offset: int = 0) -> random.Random:
    return random.Random(f"phlox:{stage}:{offset}")


def make_patient(rng: random.Random) -> dict:
    gender = rng.choice(["M", "F"])
    first = rng.choice(FIRST_NAMES_F if gender == "F" else FIRST_NAMES_M)
    dob = date.today() - timedelta(days=rng.randint(18 * 365, 95 * 365))
    return {
        "first": first,
        "last": rng.choice(SURNAMES),
        "gender": gender,
        "dob": dob.isoformat(),
        "age": (date.today() - dob).days // 365,
        "ur": f"UR{rng.randint(100000, 999999)}",
        "phone": f"04{rng.randint(10, 99)}{rng.randint(100, 999)}{rng.randint(100, 999)}",
    }


def age_from_dob(dob: str) -> int:
    y, m, d = (int(x) for x in dob.split("-"))
    today = date.today()
    a = today.year - y - ((today.month, today.day) < (m, d))
    return a


def title_case_key(key: str) -> str:
    return re.sub(r"_", " ", key).title()


# --- client-side ASR noise (free variants) ---

def asr_sloppy(text: str, rng: random.Random) -> str:
    text = text.lower()
    text = re.sub(r"[,.;:!?]+", "", text)
    text = re.sub(r"\b(um+|uh+|er+)\b", "...", text)
    return text


def inaudible_marks(text: str, rng: random.Random) -> str:
    words = text.split()
    for _ in range(min(3, len(words) // 120)):
        i = rng.randrange(len(words))
        words[i] = "[inaudible]"
    return " ".join(words)


def noisy_variant(transcript: str, sid: str) -> str | None:
    rng = rng_for("noise", stable_hash(sid) % (2**31))
    roll = rng.random()
    if roll < 0.55:
        return None
    if roll < 0.8:
        return asr_sloppy(transcript, rng)
    return inaudible_marks(transcript, rng)


# --- stages ---


def cmd_conditions() -> dict:
    path = DATA / "conditions.json"
    if path.exists():
        return json.loads(path.read_text())
    async def go():
        c = or_.Client(1)
        out = await c.json_call(
            [
                {"role": "system", "content": "You output only valid JSON."},
                {
                    "role": "user",
                    "content": (
                        "List 220 distinct medical conditions suitable for specialist outpatient "
                        "encounters, spanning these specialties: "
                        + ", ".join(SPECIALTIES)
                        + '. Return JSON: {"conditions": ["Chronic lymphocytic leukemia", ...]}. '
                        "Favor breadth across systems and severities, both acute and chronic."
                    ),
                },
            ],
            temperature=0.9,
            max_tokens=4096,
        )
        return out
    conds = asyncio.run(go())["conditions"]
    path.write_text(json.dumps(conds))
    print(f"[conditions] cached {len(conds)} conditions")
    return conds


def scenario_items(conditions: list[str]) -> list[dict]:
    items = []
    for tkey, template in TEMPLATES.items():
        for i in range(COUNTS["scenarios_per_template"]):
            rng = rng_for("scen", i + stable_hash(tkey) % (2**20))
            patient = make_patient(rng)
            returning = rng.random() < 0.6
            items.append(
                {
                    "id": f"{tkey}-{i:04d}",
                    "template_key": tkey,
                    "patient": patient,
                    "condition": conditions[(i * 7 + hash(tkey)) % len(conditions)],
                    "returning": returning,
                    "doctor": f"Dr {rng.choice(SURNAMES)}",
                    "specialty": rng.choice(SPECIALTIES),
                }
            )
    return items


async def scenario_call(client, item) -> dict:
    template = TEMPLATES[item["template_key"]]
    field_specs = [
        {
            "field_key": f["field_key"],
            "field_name": f["field_name"],
            "persistent": f["persistent"],
            "instructions": f.get("system_prompt", ""),
            "style_example": f.get("style_example", ""),
        }
        for f in template["fields"]
    ]
    p = item["patient"]
    visit = (
        f"a RETURNING patient reviewing {item['condition']}"
        if item["returning"]
        else f"a NEW referral for {item['condition']}"
    )
    async def go():
        out = await client.json_call(
            [
                {"role": "system", "content": "You are a clinical documentation synthesizer. Output only valid JSON."},
                {
                    "role": "user",
                    "content": (
                        f"Create a realistic clinic note for template '{template['template_name']}'.\n"
                        f"Patient: {p['first']} {p['last']}, {p['age']}yo {'female' if p['gender']=='F' else 'male'}, {visit}, "
                        f"seen by {item['doctor']} ({item['specialty']}).\n\n"
                        f"FIELDS (fill every one):\n{json.dumps(field_specs, indent=1)}\n\n"
                        "Rules:\n"
                        "- Content style must match each field's style_example (headers, bullets, numbering, abbreviations).\n"
                        "- Max 8 points per field, each point max ~20 words.\n"
                        "- Use realistic values with units and dates (Australian format DD/MM/YY).\n"
                        "- The plan field must have 2-6 numbered concrete actions including follow-up.\n"
                        "- Include 1-2 pertinent negatives in history-type fields.\n"
                        '- Return JSON: {"template_data": {"<field_key>": "<content>"}}.'
                    ),
                },
            ],
            temperature=0.85,
            max_tokens=4500,
        )
        td = out.get("template_data")
        if not isinstance(td, dict) or set(td) != {f["field_key"] for f in template["fields"]}:
            missing = {f["field_key"] for f in template["fields"]} - set(td or {})
            raise ValueError(f"template_data incomplete: missing {missing}")
        for v in td.values():
            if not isinstance(v, str) or not v.strip():
                raise ValueError("empty field value")
        return {"template_data": td, "patient": item["patient"], "template_key": item["template_key"],
                "doctor": item["doctor"], "specialty": item["specialty"], "returning": item["returning"]}
    return await go()


async def transcript_call(client, item) -> dict:
    scen = item["scenario"]
    mode = "dictation" if item["mode"] == "dictation" else "ambient"
    p = scen["patient"]
    if mode == "ambient":
        task = (
            f"Write a realistic {p['age']}-year-old {'female' if p['gender']=='F' else 'male'} patient "
            f"consultation transcript. Doctor: {scen['doctor']} ({scen['specialty']}).\n"
            "Format: alternating lines starting 'Doctor:' and 'Patient:'.\n"
            "Weave in EVERY fact from the note below — the transcript is the only source for extracting it later.\n"
            "Add natural speech: disfluencies (um, repeated words), patient paraphrasing and questions, "
            "brief small talk, the doctor thinking aloud. Patient describes symptoms colloquially; doctor uses jargon.\n"
            "300-600 words."
        )
    else:
        task = (
            "Convert this note into a single-speaker doctor dictation transcript. The doctor dictates "
            "the letter/note content aloud, occasionally issuing inline edit commands that must be executed "
            "rather than transcribed (e.g. 'scratch that', 'remove the last sentence', 'actually add her recent "
            "blood results'). 200-450 words, one paragraph per field, spoken register."
        )
    async def go():
        out = await client.json_call(
            [
                {"role": "system", "content": "You are a medical speech transcriber. Output only valid JSON."},
                {
                    "role": "user",
                    "content": f"{task}\n\nNOTE:\n{json.dumps(scen['template_data'], indent=1)}\n\n"
                    '- Return JSON: {"transcript": "..."}',
                },
            ],
            temperature=0.75,
            max_tokens=5000,
        )
        t = out.get("transcript")
        if not isinstance(t, str) or len(t) < 400:
            raise ValueError(f"transcript too short: {len(t) if isinstance(t, str) else t}")
        return {"transcript": t, "mode": mode, "scenario_id": item["id"]}
    return await go()


async def letter_call(client, item) -> dict:
    scen = item["scenario"]
    p = scen["patient"]
    note = "\n\n".join(
        f"{title_case_key(k)}:\n{v}" for k, v in scen["template_data"].items() if v
    )
    is_dictation = item["letter_type"] == "dictation"
    instruction = SPEC["dictation"]["instructions"] if is_dictation else item["instructions"]
    if is_dictation:
        # dictation polish: the "note" is a dictated rough letter; synthesize one from the note fields
        dictated = " ".join(v for v in scen["template_data"].values())[:1800]
        user_note = dictated
    else:
        user_note = note
    async def go():
        out = await client.json_call(
            [
                {
                    "role": "system",
                    "content": (
                        "You write exemplar medical correspondence for training data. Use ONLY facts in the note. "
                        "Typical shape: date line, addressee, RE: patient/UR, salutation, 2-5 concise body paragraphs "
                        "covering the note, management/follow-up, thanks, sign-off with specialist name and title. "
                        f"Sign as {scen['doctor']}, {scen['specialty']}. "
                        + ("This is a polished version of a dictated letter; preserve its substance and ordering."
                           if is_dictation else "150-350 words.")
                    ),
                },
                {
                    "role": "user",
                    "content": f"Letter instructions: {instruction}\n\nPatient: {p['first']} {p['last']}\n"
                    f"Gender: {p['gender']}\nAge: {p['age']}\n\nClinic Note:\n{user_note}\n\n"
                    '- Return JSON: {"letter": "..."}',
                },
            ],
            temperature=0.6,
            max_tokens=4000,
        )
        letter = out.get("letter")
        if not isinstance(letter, str) or len(letter) < 200:
            raise ValueError("letter too short")
        return {"letter": letter, "scenario_id": item["scenario_id"], "letter_type": item["letter_type"],
                "instructions": instruction}
    return await go()


async def refinement_call(client, item) -> dict:
    letter = item["letter"]
    rng = rng_for("refine", stable_hash(item["id"]) % (2**31))
    turns_wanted = rng.choice([1, 1, 2, 3])
    requests = rng.sample(REFINEMENT_POOL, turns_wanted)
    async def go():
        out = await client.json_call(
            [
                {"role": "system", "content": "You simulate a specialist refining a letter. Output only valid JSON."},
                {
                    "role": "user",
                    "content": (
                        f"CURRENT LETTER:\n{letter}\n\n"
                        f"The specialist requests these edits in sequence: {json.dumps(requests)}\n"
                        "Produce the episode: for each request, the revised FULL replacement letter after that edit. "
                        "Each revision must honor its request, keep the rest stable, stay medically accurate.\n"
                        '- Return JSON: {"turns": [{"request": "...", "revised_letter": "..."}]} '
                        f"with exactly {turns_wanted} turns. Use the requests verbatim."
                    ),
                },
            ],
            temperature=0.6,
            max_tokens=9000,
        )
        turns = out.get("turns")
        if not isinstance(turns, list) or not turns:
            raise ValueError("no turns")
        for t in turns:
            if not isinstance(t.get("request"), str) or not isinstance(t.get("revised_letter"), str) or len(t["revised_letter"]) < 150:
                raise ValueError("malformed turn")
        return {"turns": turns, "letter_id": item["letter_id"]}
    return await go()


async def jobs_call(client, item) -> dict:
    system = (
        PROMPTS["job_extraction"]["system"]
        + '\n\nReturn ONLY valid JSON with this top-level shape:\n'
        '{"action_items": [{"text": "...", "category": "action", "rationale": "..."}], '
        '"excluded": [{"text": "...", "category": "follow_up", "rationale": "..."}]}'
    )
    async def go():
        out = await client.json_call(
            [{"role": "system", "content": system}, {"role": "user", "content": item["plan"]}],
            temperature=0.2,
            max_tokens=1500,
        )
        if not isinstance(out.get("action_items"), list) or not out["action_items"]:
            raise ValueError("no action_items")
        return {"jobs": out, "plan": item["plan"], "scenario_id": item["id"]}
    return await go()


DEMOGRAPHICS_KEYS = ["first_name", "last_name", "dob", "gender", "ur_number", "address", "phone"]


async def demographics_call(client, item) -> dict:
    scen = item["scenario"]
    p = scen["patient"]
    rng = rng_for("demo", stable_hash(item["id"]) % (2**31))
    include = ["first_name", "last_name"] + rng.sample(
        [k for k in DEMOGRAPHICS_KEYS if k not in ("first_name", "last_name")], rng.randint(2, 5)
    )
    facts = {
        "first_name": p["first"],
        "last_name": p["last"],
        "dob": f"{p['dob'][8:10]}/{p['dob'][5:7]}/{p['dob'][:4]}",
        "gender": "male" if p["gender"] == "M" else "female",
        "ur_number": p["ur"],
        "address": f"{rng.randint(1, 200)} {rng.choice(['Collins', 'Bourke', 'Lonsdale', 'Elizabeth', 'Swanston'])} St, {'Melbourne' if rng.random()<0.7 else 'Richmond'} VIC",
        "phone": p["phone"],
    }
    present = {k: facts[k] for k in include}
    async def go():
        out = await client.json_call(
            [
                {"role": "system", "content": "You write realistic clinical document fragments. Output only valid JSON."},
                {
                    "role": "user",
                    "content": (
                        "Write a 40-90 word snippet that could open a real referral letter / discharge summary / "
                        "pathology report, embedding these patient demographics naturally and in varied formats "
                        f"(labels, initials, reordered): {json.dumps(present)}.\n"
                        "Do not invent other demographics (no age if DOB given is enough, etc.).\n"
                        '- Return JSON: {"document": "..."}'
                    ),
                },
            ],
            temperature=0.8,
            max_tokens=2500,
        )
        doc = out.get("document")
        if not isinstance(doc, str) or len(doc) < 40:
            raise ValueError("bad document")
        label = {k: (facts[k] if k in include else None) for k in DEMOGRAPHICS_KEYS}
        label["dob"] = p["dob"] if "dob" in include else None  # production expects ISO when determinable
        label["gender"] = p["gender"] if "gender" in include else None
        return {"document": doc, "label": label}
    return await go()


# --- stage runners ---


def run(stage: str, items, make_calls, concurrency=16) -> list[dict]:
    return asyncio.run(or_.run_stage(stage, items, make_calls, concurrency))


def stage_scenarios():
    conditions = cmd_conditions()
    items = scenario_items(conditions)
    return run("scenarios", items, scenario_call)


def stage_transcripts():
    scen = or_.load_stage_results("scenarios")
    if not scen:
        raise SystemExit("run scenarios first")
    items = []
    for sid, s in scen.items():
        mode = "dictation" if rng_for("mode", stable_hash(sid) % (2**31)).random() < 0.25 else "ambient"
        items.append({"id": sid, "scenario": s, "mode": mode})
    results = run("transcripts", items, transcript_call)
    # client-side noise variants stored alongside
    noisy_path = DATA / "noise.jsonl"
    if not noisy_path.exists():
        with noisy_path.open("w") as f:
            for r in results:
                v = noisy_variant(r["transcript"], r["scenario_id"])
                if v:
                    f.write(json.dumps({"scenario_id": r["scenario_id"], "transcript": v, "mode": r["mode"]}) + "\n")
        print("[noise] variants written")
    return results


def stage_letters():
    scen = list(or_.load_stage_results("scenarios").values())
    if not scen:
        raise SystemExit("run scenarios first")
    rng = rng_for("letters", 1)
    types = [lt["name"] for lt in LETTER_TEMPLATES] + ["dictation"]
    items = []
    for i in range(COUNTS["letters"]):
        s = scen[(i * 13 + 7) % len(scen)]
        lt = rng.choice(LETTER_TEMPLATES) if rng.random() > 0.15 else None
        ltype = "dictation" if lt is None else lt["name"]
        items.append({
            "id": f"L{i:05d}",
            "scenario_id": s["id"],
            "scenario": s,
            "letter_type": ltype,
            "instructions": (lt or {}).get("instructions", ""),
        })
    return run("letters", items, letter_call)


def stage_refinement():
    letters = or_.load_stage_results("letters")
    if not letters:
        raise SystemExit("run letters first")
    rng = rng_for("refsel", 2)
    chosen = rng.sample(list(letters.values()), min(COUNTS["refinement"], len(letters)))
    items = [{"id": f"R{i:05d}", "letter_id": l["id"], "letter": l["letter"]} for i, l in enumerate(chosen)]
    return run("refinement", items, refinement_call)


def stage_jobs():
    scen = list(or_.load_stage_results("scenarios").values())
    if not scen:
        raise SystemExit("run scenarios first")
    rng = rng_for("jobsel", 3)
    items = [
        {"id": f"J{i:05d}", "scenario_id": s["id"], "plan": s["template_data"]["plan"]}
        for i, s in enumerate(rng.sample(scen, min(COUNTS["jobs"], len(scen))))
    ]
    return run("jobs", items, jobs_call)


def stage_demographics():
    scen = list(or_.load_stage_results("scenarios").values())
    if not scen:
        raise SystemExit("run scenarios first")
    rng = rng_for("demosel", 4)
    items = [
        {"id": f"D{i:05d}", "scenario_id": s["id"], "scenario": s}
        for i, s in enumerate(rng.sample(scen, min(COUNTS["demographics"], len(scen))))
    ]
    return run("demographics", items, demographics_call)


def stage_hf():
    try:
        os = __import__("os")
        os.environ.setdefault("HF_HOME", "/tmp/opencode/hf_cache")
        from datasets import load_dataset
    except Exception as e:  # noqa: BLE001
        print(f"[hf] skipping ({e})")
        return []
    try:
        ds = load_dataset("BeTraC/betrac-2026")
    except Exception as e:  # noqa: BLE001
        print(f"[hf] dataset unavailable, skipping ({e})")
        return []
    rows = list(ds[list(ds.keys())[0]])[: COUNTS["hf"]]
    if not rows:
        print("[hf] empty dataset, skipping")
        return []
    cols = list(rows[0].keys())
    print(f"[hf] {len(rows)} rows, columns: {cols}")
    def text_col(row):
        best, n = None, 0
        for c in cols:
            v = row.get(c)
            if isinstance(v, str) and len(v) > n:
                best, n = c, len(v)
        return best
    items = []
    for i, row in enumerate(rows):
        c = text_col(row)
        if not c or len(row[c]) < 400:
            continue
        items.append({"id": f"H{i:05d}", "transcript": row[c]})
    async def hf_call(client, item):
        template = TEMPLATES["soap_01"]
        out = await client.json_call(
            [
                {"role": "system", "content": "You are a clinical documentation annotator. Output only valid JSON."},
                {
                    "role": "user",
                    "content": (
                        "Extract the non-persistent fields for a SOAP note from this transcript. "
                        "Fields: subjective, objective, assessment, plan. "
                        "Each field: list of short single-line points (max 6), or empty list if absent.\n\n"
                        f"TRANSCRIPT:\n{item['transcript'][:8000]}\n\n"
                        '- Return JSON: {"field_summaries": {"subjective": [...], "objective": [...], '
                        '"assessment": [...], "plan": [...]}}'
                    ),
                },
            ],
            temperature=0.2,
            max_tokens=2000,
        )
        fs = out.get("field_summaries")
        if not isinstance(fs, dict) or not any(isinstance(v, list) and v for v in fs.values()):
            raise ValueError("empty field_summaries")
        return {"field_summaries": fs, "template_key": "soap_01"}
    return run("hf", items, hf_call)


STAGES = {
    "conditions": cmd_conditions,
    "scenarios": stage_scenarios,
    "transcripts": stage_transcripts,
    "letters": stage_letters,
    "refinement": stage_refinement,
    "jobs": stage_jobs,
    "demographics": stage_demographics,
    "hf": stage_hf,
}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=[*STAGES, "all"])
    args = ap.parse_args()
    if args.stage == "all":
        # ponytail: "hf" stage dropped from the chain — 1GB audio-bearing dataset vs
        # 1.6G free disk next to a live burn; synthetic core covers the distribution.
        # Re-enable via `python generate.py hf` on a roomy machine (Colab) if eval
        # shows scribe weakness on real-transcript diversity.
        for name in ("scenarios", "transcripts", "letters", "refinement", "jobs", "demographics"):
            print(f"=== {name} ===", flush=True)
            STAGES[name]()
    else:
        STAGES[args.stage]()
