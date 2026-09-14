"""One-shot recovery: rebuild correct scenario/letter linkage in letters.jsonl and refinement.jsonl.

generate.py stored stage-item ids ("L00004"/"R00012") where linkage ids belonged
(bug: letter_call returned scenario_id=item["id"]; refinement_call returned
letter_id=item["id"]). Both mappings are exactly recomputable:

  letters:      stage_letters sampled scen[(i*13+7) % len(scen)] with i = int(id[1:])
  refinement:   rng_for("refsel", 2).sample(<letters in file order>, 2499); R{i} -> chosen[i]

Every rewritten id is verified to resolve before anything is written.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

DATA = Path(__file__).parent / "data"


def load_rows(name: str) -> list[dict]:
    return [json.loads(l) for l in (DATA / name).read_text().splitlines() if l.strip()]


def main():
    scen = load_rows("scenarios.jsonl")
    scen_ids = {s["id"] for s in scen}
    letters = load_rows("letters.jsonl")
    refinement = load_rows("refinement.jsonl")
    assert len(scen) == 10000 and len(letters) == 2499, (len(scen), len(letters))

    # letters: i -> scenario arithmetic
    fixed_letters = 0
    for rec in letters:
        i = int(rec["id"][1:])
        correct = scen[(i * 13 + 7) % len(scen)]["id"]
        assert correct in scen_ids
        if rec.get("scenario_id") != correct:
            rec["scenario_id"] = correct
            fixed_letters += 1

    # refinement: deterministic seeded permutation over letters-in-file-order
    chosen = random.Random("phlox:refsel:2").sample(letters, min(3000, len(letters)))
    assert len(chosen) == len(refinement), (len(chosen), len(refinement))
    letter_ids = {l["id"] for l in letters}
    fixed_ref = 0
    for rec in refinement:
        i = int(rec["id"][1:])
        correct = chosen[i]["id"]
        assert correct in letter_ids
        if rec.get("letter_id") != correct:
            rec["letter_id"] = correct
            fixed_ref += 1

    # verify every refinement letter's scenario also resolves (transitive check)
    lmap = {l["id"]: l for l in letters}
    for rec in refinement:
        assert lmap[rec["letter_id"]]["scenario_id"] in scen_ids

    for name, rows in (("letters.jsonl", letters), ("refinement.jsonl", refinement)):
        tmp = DATA / (name + ".tmp")
        with tmp.open("w") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        tmp.replace(DATA / name)
    print(f"fixed {fixed_letters} letters scenario_ids, {fixed_ref} refinement letter_ids; all linkages verified")


if __name__ == "__main__":
    main()
