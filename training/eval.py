"""Eval gate: base vs fine-tuned on sft_dev.jsonl. Run on Colab (GPU) after training.

  python eval.py --model Qwen/Qwen3.5-0.8B --limit 300
  python eval.py --model ./qwen-phlox-merged --limit 300

Metrics are the app's real failure modes: production-parser success rates
(parseFieldSummaries port, jobs/demographics brace-slice), scribe field-presence
F1, demographics key accuracy, letter ROUGE-L.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

DATA = Path(__file__).parent / "data"

TEMPERATURES = {"scribe": 0.1, "scribe_doc": 0.1, "jobs": 0.1, "demographics": 0.1, "letter": 0.6, "letter_refine": 0.6}
MAX_NEW_TOKENS = {"scribe": 1024, "scribe_doc": 1024, "jobs": 512, "demographics": 256, "letter": 1024, "letter_refine": 1024}


def task_family(task: str) -> str:
    return task.split(":")[0].replace("_doc", "").replace("_refine", "")


# --- production parsers, ported ---

def normalize_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower())


def parse_field_summaries(content: str, field_keys: list[str]):
    """Port of scribe.ts:parseFieldSummaries. Returns dict or raises."""
    start = content.find("{")
    end = content.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object")
    parsed = json.loads(content[start : end + 1])
    wrapped = parsed.get("field_summaries")
    source = wrapped if isinstance(wrapped, dict) and not isinstance(wrapped, list) else parsed
    # bounded de-nest: small models double-wrap the envelope (see scribe.ts)
    depth = 0
    while isinstance(source.get("field_summaries"), dict) and depth < 3:
        source = source["field_summaries"]
        depth += 1
    aliases = {}
    for k in field_keys:
        aliases[normalize_key(k)] = k
    out = {}
    for key, value in source.items():
        resolved = aliases.get(key) or aliases.get(normalize_key(key))
        if not resolved:
            continue
        if isinstance(value, list):
            out[resolved] = [str(p) for p in value]
        elif isinstance(value, str) and value.strip():
            out[resolved] = [value]
    if not out:
        raise ValueError(f"no recognized fields (keys: {list(source)[:8]})")
    return out


def parse_jobs_or_demographics(content: str):
    start = content.find("{")
    end = content.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object")
    return json.loads(content[start : end + 1])


# --- content metrics ---

STOP = set("the a an of to in and or for with on at by is was were be been no not nil none".split())


def content_words(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP and len(w) > 2}


def point_recall(gold_points: list[str], pred_points: list[str]) -> float:
    """Fraction of gold points covered by some predicted point (>=50% content-word overlap)."""
    if not gold_points:
        return 1.0
    pred_sets = [content_words(p) for p in pred_points if p.strip()]
    hit = 0
    for g in gold_points:
        gw = content_words(g)
        if not gw:
            continue
        if any(len(gw & pw) / len(gw) >= 0.5 for pw in pred_sets if pw):
            hit += 1
    return hit / len(gold_points)


def rouge_l(a: str, b: str) -> float:
    """LCS-based ROUGE-L F1 on word tokens. ~25 lines, no deps."""
    wa, wb = re.findall(r"[a-z0-9]+", a.lower()), re.findall(r"[a-z0-9]+", b.lower())
    if not wa or not wb:
        return 0.0
    prev = [0] * (len(wb) + 1)
    for i in range(1, len(wa) + 1):
        cur = [0] * (len(wb) + 1)
        for j in range(1, len(wb) + 1):
            cur[j] = prev[j - 1] + 1 if wa[i - 1] == wb[j - 1] else max(prev[j], cur[j - 1])
        prev = cur
    lcs = prev[-1]
    p, r = lcs / len(wa), lcs / len(wb)
    return 2 * p * r / (p + r) if p + r else 0.0


# --- scoring per task ---

def score_example(ex: dict, pred: str) -> dict:
    fam = task_family(ex["task"])
    if fam == "scribe":
        keys = list(json.loads(ex["completion"])["field_summaries"].keys())
        try:
            got = parse_field_summaries(pred, keys)
        except Exception:
            return {"ok": 0, "recall": 0.0, "letters": 0.0}
        gold = json.loads(ex["completion"])["field_summaries"]
        recalls = [point_recall(gold.get(k, []), got.get(k, [])) for k in keys]
        return {"ok": 1, "recall": sum(recalls) / len(recalls), "letters": 0.0}
    if fam == "jobs":
        try:
            got = parse_jobs_or_demographics(pred)
            n = len(got.get("action_items", []))
        except Exception:
            return {"ok": 0, "recall": 0.0, "letters": 0.0}
        gold = json.loads(ex["completion"])
        gold_items = [a["text"] for a in gold.get("action_items", [])]
        got_items = [str(a.get("text", "")) for a in (n and got["action_items"] or [])]
        if not gold_items:
            return {"ok": 1, "recall": 1.0, "letters": 0.0}
        return {"ok": 1, "recall": point_recall(gold_items, got_items), "letters": 0.0}
    if fam == "demographics":
        try:
            got = parse_jobs_or_demographics(pred)
        except Exception:
            return {"ok": 0, "recall": 0.0, "letters": 0.0}
        gold = json.loads(ex["completion"])
        correct = sum(
            1
            for k, v in gold.items()
            if isinstance(v, str) and str(got.get(k, "")).strip().lower() == v.strip().lower()
        )
        total = sum(1 for v in gold.values() if isinstance(v, str))
        return {"ok": 1, "recall": correct / total if total else 1.0, "letters": 0.0}
    # letters + refinement
    return {"ok": 1, "recall": 0.0, "letters": rouge_l(ex["completion"], pred)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--dev", default=str(DATA / "sft_dev.jsonl"))
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM

    try:  # surface kernel import failures instead of letting transformers silently fall back
        __import__("fla")
        print("[eval] fla kernel available", file=sys.stderr)
    except Exception:
        import traceback

        traceback.print_exc()

    examples = [json.loads(l) for l in open(args.dev) if l.strip()]
    if args.limit:
        examples = examples[: args.limit]
    tok = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model, torch_dtype=torch.bfloat16, device_map="auto")
    model.eval()

    per_task: dict[str, Counter] = {}
    for i, ex in enumerate(examples):
        fam = task_family(ex["task"])
        prompt = tok.apply_chat_template(
            ex["prompt"], add_generation_prompt=True, enable_thinking=False, tokenize=False
        )
        inputs = tok(prompt, return_tensors="pt").to(model.device)
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=MAX_NEW_TOKENS[fam],
                do_sample=TEMPERATURES[fam] > 0,
                temperature=max(TEMPERATURES[fam], 0.05),
            )
        new_tokens = out[0][inputs["input_ids"].shape[1]:]
        text = tok.decode(new_tokens, skip_special_tokens=True)
        text = text.split("</think>").pop().strip()
        s = score_example(ex, text)
        c = per_task.setdefault(f"{ex['task']}", Counter())
        c.update(n=1, ok=s["ok"], recall=s["recall"], letters=s["letters"])
        if (i + 1) % 50 == 0:
            print(f"{i + 1}/{len(examples)}", file=sys.stderr, flush=True)

    summary = {}
    print(f"\nmodel: {args.model}")
    print(f"{'task':<28}{'n':>5}{'parse%':>8}{'recall/F1':>11}{'rougeL':>8}")
    for task in sorted(per_task):
        c = per_task[task]
        summary[task] = {k: c[k] for k in ("n", "ok", "recall", "letters")}
        print(
            f"{task:<28}{c['n']:>5}{100 * c['ok'] / c['n']:>7.1f}%"
            f"{c['recall'] / c['n']:>11.3f}{c['letters'] / c['n']:>8.3f}"
        )
    total = Counter()
    for c in per_task.values():
        total.update(c)
    summary["_total"] = {k: total[k] for k in ("n", "ok", "recall", "letters")}
    print(
        f"{'TOTAL':<28}{total['n']:>5}{100 * total['ok'] / total['n']:>7.1f}%"
        f"{total['recall'] / total['n']:>11.3f}{total['letters'] / total['n']:>8.3f}"
    )
    if args.out:
        Path(args.out).write_text(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
