# Phlox browser-only demo — developer notes

Pure in-browser demo: localStorage "backend" (src/localBackend), local ASR + LLM, no server.

## Engines

| component | primary | fallback | selection |
|---|---|---|---|
| LLM | **WebLLM** (MLC/TVM WebGPU kernels) — `phlox-0.8b-webllm` preset, weights from HF `bloodworks-io/phlox-0.8b-MLC` | transformers.js (ONNX q4) — tuned preset, weights from HF `bloodworks-io/phlox-0.8b-ONNX` | settings radio group; WebLLM path needs adapter `maxStorageBuffersPerShaderStage >= 10` (Chrome/Edge), else it silently falls back to the transformers.js engine |
| ASR | **parakeet.wgsl** (raw WGSL compute shaders) — `parakeet` preset, mirror in `public/models/parakeet/{fp16,fp32}/` | whisper (transformers.js wasm) | settings dropdown; parakeet needs WebGPU (falls back to whisper otherwise) |
| streaming capture | utterance-at-a-time ASR (TEN VAD segmentation) during recording + CAM++ speaker diarization (ambient) + KV prefill warming on both LLM engines | batch whole-blob path (record → one ASR pass → extraction) | automatic; capture falls back to batch on any failure (`{fallback: true}` from stop) |

JSON-schema-constrained generation (scribe fields): WebLLM native
`response_format: json_object`; transformers.js path uses
`@mlc-ai/web-xgrammar` manually. Capture warming is engine-aware: on the
transformers.js engine it's a raw-forward DynamicCache prefill seeded into
the final `generate()`; on WebLLM it's a 1-token request riding the engine's
in-memory prefix reuse (`capture.ts kvWarmingEnabled` gates on a loaded
WebGPU engine either way; wasm tjs is excluded). Since a warm never loads an
engine by itself, capture start preloads the WebLLM engine from the browser
cache (`llm.ts preloadWebLLMForCapture`) — a first-ever run without cached
weights skips the preload and loads at extraction time as before.

## Browser matrix (measured on M3 MacBook Air)

| browser | ASR | LLM |
|---|---|---|
| Chrome/Edge | parakeet ~20× RT | WebLLM (fast) |
| Safari | parakeet ~20× RT | transformers.js q4 (~15s/scribe) — WebLLM blocked by adapter limit 9 < 10 |
| Firefox | parakeet slow (first-run shader compile heavy; naga rejects the bitcast probe, portable kernels) | transformers.js |

## Dev

```bash
npm install
npm run start-react          # vite dev server on :3000 (no Python server on this branch)
# browse via ssh -L 3000:localhost:3000 (WebGPU needs a secure context)
```

Dev-only spike pages: `/webllm-spike.html` (WebLLM perf measurement), `?bench` ideas in `src/webllmSpike.js`.

## Model artifacts (gitignored: `public/models/`)

The LLM weights are always fetched from the HF hub (`bloodworks-io/phlox-0.8b-MLC` for WebLLM, `bloodworks-io/phlox-0.8b-ONNX` for transformers.js) — the demo is web-deployed and never serves an LLM mirror itself. Only the ASR keeps a local-mirror convention:

- `parakeet/{fp16,fp32}` → optional byte-exact mirrors of the canonical parakeet.wgsl packages (probed first; the parakeet.wgsl project CDN is the fallback)

Exception: `public/models/campplus-zh-en.onnx` (28 MB, the capture
diarizer's CAM++ embedding model — same weights as
`server/assets/models/`) **is committed**: it has no HF mirror and is small
enough to deploy with the app shell.

The vite middleware (`vite.config.js`, `models-hard-404`) turns missing `/models/*` files into hard 404s — required so transformers.js/parakeet can probe optional files instead of receiving the SPA's index.html.

## Model weight updates

Fine-tune lives in the training repo; after retraining + merge: re-run the exporters there and the new weights are live here via the symlinks (bump nothing; browsers cache by URL — use Cache Storage clear or new dir names for forced refresh).

See `DEPLOY.md` for the production weight hosting (HF repos) and
`BROWSER_ONLY_TECH_DEMO_PLAN.md` § "Streaming capture" for the capture
architecture and its browser-specific divergences from `origin/main`.
