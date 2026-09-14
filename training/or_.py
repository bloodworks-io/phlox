"""OpenRouter client: resumable, spend-capped, backoff-aware.

Every stage writes one JSON line per completed item into training/data/<stage>.jsonl;
resume = skip ids already present. Spend is accumulated in training/data/spend.json
(updated after every call); hitting SPEND_LIMIT aborts the run cleanly.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import time
from pathlib import Path

import httpx

DATA = Path(__file__).parent / "data"
DATA.mkdir(exist_ok=True)
ENV_PATH = Path(__file__).parent / ".env"


def _load_env():
    if not ENV_PATH.exists():
        raise SystemExit("training/.env missing")
    env = {}
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


ENV = _load_env()
API_KEY = ENV["OPENROUTER_API_KEY"]
MODEL = ENV.get("MODEL", "meta/muse-spark-1.3-contributor")
SPEND_LIMIT = float(ENV.get("SPEND_LIMIT", "20"))

BASE = "https://openrouter.ai/api/v1/chat/completions"


class SpendKill(Exception):
    pass


class Client:
    def __init__(self, concurrency: int = 16):
        self.http = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=httpx.Timeout(300, connect=30),
        )
        self.sem = asyncio.Semaphore(concurrency)
        self.spend_path = DATA / "spend.json"
        self.spend = json.loads(self.spend_path.read_text()) if self.spend_path.exists() else {"cost": 0.0, "calls": 0}
        self._spend_lock = asyncio.Lock()
        self.killed = False

    async def _track_spend(self, cost: float):
        async with self._spend_lock:
            self.spend["cost"] += cost
            self.spend["calls"] += 1
            self.spend_path.write_text(json.dumps(self.spend))
            if self.spend["cost"] >= SPEND_LIMIT:
                self.killed = True

    async def call(
        self,
        messages: list[dict],
        *,
        json_mode: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        """One chat completion. Retries 429/5xx with jittered backoff; raises SpendKill."""
        body: dict = {
            "model": MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "reasoning_effort": "low",  # ponytail: hidden reasoning tokens are billed; low is plenty for synthesis
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        for attempt in range(6):
            if self.killed:
                raise SpendKill(f"spend {self.spend['cost']:.2f} >= {SPEND_LIMIT}")
            async with self.sem:
                r = await self.http.post(BASE, json=body)
            if r.status_code == 200:
                d = r.json()
                await self._track_spend(float(d.get("usage", {}).get("cost") or 0))
                content = d["choices"][0]["message"].get("content")
                if not content:
                    raise ValueError(f"empty content (finish={d['choices'][0].get('finish_reason')})")
                return content
            if r.status_code in (429, 408, 500, 502, 503, 504):
                wait = min(120, (2 ** attempt) + random.random() * 2)
                await asyncio.sleep(wait)
                continue
            raise RuntimeError(f"{r.status_code}: {r.text[:300]}")
        raise RuntimeError(f"gave up after retries: {messages[0]['content'][:80]}")

    async def json_call(self, messages: list[dict], **kw) -> dict:
        """JSON-mode call tolerant of code fences / trailing text around the object."""
        text = await self.call(messages, json_mode=True, **kw)
        return parse_json(text)


def parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError(f"no JSON object in: {text[:200]}")
    return json.loads(text[start : end + 1])


def load_stage_results(stage: str) -> dict:
    """id -> result for items already completed in a stage."""
    path = DATA / f"{stage}.jsonl"
    done: dict[str, dict] = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if line.strip():
                try:
                    rec = json.loads(line)
                    done[rec["id"]] = rec
                except json.JSONDecodeError:
                    continue  # torn final line from an interrupted run
    return done


async def run_stage(stage: str, items: list[dict], make_calls, concurrency: int = 16) -> list[dict]:
    """Run a stage resumably. items: [{id, ...}] — make_calls(client, item) -> dict payload.

    Writes one JSONL line per success: {id, **payload, cost_at_write}. Failed items
    are logged to <stage>.failures and retried on the next run of the same stage.
    """
    client = Client(concurrency)
    done = load_stage_results(stage)
    out_path = DATA / f"{stage}.jsonl"
    fail_path = DATA / f"{stage}.failures"
    todo = [it for it in items if it["id"] not in done]
    print(f"[{stage}] {len(items)} items, {len(done)} done, {len(todo)} todo", flush=True)
    if not todo:
        return list(done.values())
    sem_written = asyncio.Semaphore(1)  # serialize appends
    processed = 0
    started = time.time()

    async def one(item):
        nonlocal processed
        try:
            payload = await make_calls(client, item)
            rec = {"id": item["id"], **payload}
            async with sem_written:
                with out_path.open("a") as f:
                    f.write(json.dumps(rec) + "\n")
            processed += 1
            if processed % 25 == 0:
                rate = processed / max(1e-9, time.time() - started)
                eta = (len(todo) - processed) / max(1e-9, rate) / 60
                print(
                    f"[{stage}] {processed}/{len(todo)} | ${client.spend['cost']:.2f} spent | eta {eta:.0f}m",
                    flush=True,
                )
        except SpendKill:
            raise
        except Exception as e:  # noqa: BLE001 — log and continue; rerun picks these up
            async with sem_written:
                with fail_path.open("a") as f:
                    f.write(json.dumps({"id": item["id"], "error": str(e)[:300]}) + "\n")

    try:
        await asyncio.gather(*(one(item) for item in todo))
        # ponytail: SpendKill leaves the remaining coros unawaited by design — rerun resumes
    except SpendKill as e:
        print(f"[{stage}] SPEND KILL at ${client.spend['cost']:.2f}: {e}", flush=True)
    print(
        f"[{stage}] finished: {len(load_stage_results(stage))}/{len(items)} ok, "
        f"${client.spend['cost']:.2f} total spent",
        flush=True,
    )
    return list(load_stage_results(stage).values())
