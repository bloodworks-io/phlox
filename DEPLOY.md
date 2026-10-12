# Deploying the browser-only demo (GitHub Pages + Hugging Face)

The demo is 100% static: GitHub Pages serves the app shell (~2MB); model
weights are far too large for GitHub (100MB/file, 1GB/site limits) and are
hosted on the **Hugging Face Hub**, which every engine in this app loads from
natively over CORS.

## Architecture at deploy time

| artifact | size | hosted at | loaded by |
|---|---|---|---|
| app shell (vite build) | ~2MB | GitHub Pages (`demo-pages.yml` auto-deploys on push to `demo/browser-only`) | — |
| `phlox-0.8b-MLC-v2` (WebLLM q4f16 package) | ~443MB | HF repo `bloodworks-io/phlox-0.8b-MLC-v2` | WebLLM 0.8B preset (Chrome/Edge) |
| `phlox-2b-MLC-v2` (WebLLM q4f16 package) | ~1.1GB | HF repo `bloodworks-io/phlox-2b-MLC-v2` | WebLLM 2B preset (Chrome/Edge) |
| `phlox-*-ONNX-v2` (transformers.js packages) | 0.8B ~600MB / 2B ~1.4GB (q4 + q8 sets) | HF repos `bloodworks-io/phlox-{0.8b,2b}-ONNX-v2` | transformers.js presets + fallbacks (Safari/Firefox) |
| OmiMed ASR package (fp16) | ~413MB | HF repo `bloodworks-io/parakeet-omimed-v1` (converted by the vendored fork; CC-BY-4.0 chain OmiMed → NVIDIA, see its README/NOTICE) | omimed preset — the only ASR option (any WebGPU browser; whisper otherwise) |
| WebLLM model libs (`phlox-{0.8b,2b}-webgpu.wasm`) | 6MB each | inside the MLC repos | WebLLM |
| CAM++ speaker diarizer (`campplus-zh-en.onnx`) | 28MB | committed in-repo at `public/models/campplus-zh-en.onnx` (gitignore exception — no HF mirror) | capture diarization (`speakers.ts`) |

Runtime URL selection: LLM weights always come from the HF repos configured
in `src/localBackend/llm.ts` (`HF_ORG`) — the app never serves an LLM mirror.
The ASR HEAD-probes `/models/parakeet-omimed/*` on its own origin first
(dev mirror) and falls back to the HF mirror in `asr.ts` — the package's
third-party default CDN is never reached. No build-time configuration
required.

## 1. Upload weights to Hugging Face (once per model version)

From the training box (`train-phlox`), with `hf` authenticated
(`hf auth login`, write access to the org):

```bash
# WebLLM packages (converted weights + wasm + configs)
hf upload bloodworks-io/phlox-0.8b-MLC-v2 dist/phlox-0.8b-v2-q4f16-1-MLC . --repo-type model
hf upload bloodworks-io/phlox-2b-MLC-v2 dist/phlox-2b-q4f16-1-MLC . --repo-type model

# transformers.js packages: upload the package ROOT so config/tokenizer sit
# at the repo root and the weights land at onnx/*.onnx (transformers.js
# resolves weights under the onnx/ subfolder — root-level .onnx files 404)
hf upload bloodworks-io/phlox-0.8b-ONNX-v2 out/onnx-tjs/phlox-0.8b-v2 . --repo-type model
hf upload bloodworks-io/phlox-2b-ONNX-v2 out/onnx-tjs/phlox-2b . --repo-type model
```

Set the repos to **public** (Settings tab). HF serves every file with
`Access-Control-Allow-Origin: *`, which is all the engines need.


## The parakeet.wgsl fork (vendored at `vendor/parakeet.wgsl`)

The npm dependency is a **vendored prebuilt fork** of
narcotic-sh/parakeet.wgsl (MIT) with per-layer encoder-adapter support
(OmiMed's `medical_v1d_rank128`), consumed as `"parakeet.wgsl":
"file:vendor/parakeet.wgsl"` so `npm ci` in the Pages workflow is
self-contained — no npm publish or git dependency. Rebuilding it:

1. Source lives at https://git.guthrie.dev/jfgonsalves/parakeet.wgsl-omimed
   (fork of narcotic-sh/parakeet.wgsl; local checkout
   `~/Code/parakeet.wgsl-omimed`).
2. `npx pnpm@10.20.0 build` in the fork, then refresh `vendor/parakeet.wgsl`
   (dist + license/notices; keep the minimal vendored package.json with no
   lifecycle scripts) and `npm install` in this repo.
3. The OmiMed package converter (`model/convert.py --precision fp16
   --archive <omimedstt-v1.nemo>`) produces `model/files`; verify with
   `verify_adapter_packing.py`, then `hf upload bloodworks-io/
   parakeet-omimed-v1 model/files fp16/<manifest-sha>` and update
   `OMIMED_FP16_MANIFEST_SHA256` + the fp16 manifest byte-length pin in the
   fork's `webgpu-engine.ts` if the manifest hash changes.

Note: the stock (unfinetuned) parakeet preset has been removed —
`omimed` is the default and only parakeet.wgsl-engine option (whisper
remains the non-WebGPU fallback). The encoder hard-requires the OmiMed
adapter package regardless.

The packages are modified forms of NVIDIA Parakeet TDT 0.6B v2 (CC BY 4.0) —
hosting the mirror redistributes them, so the repo carries attribution: a
README + NOTICE at the repo root (OmiMed → NVIDIA source models + pinned
revisions, parakeet.wgsl repack credit). Keep them when re-uploading.

## 2. Check app constants

- `HF_ORG` in `src/localBackend/llm.ts` — must match your HF org.
- ASR preset default (`parakeet`) in `src/localBackend/db.ts`.
- `vite.config.js` already derives the Pages subpath from
  `GITHUB_PAGES_BASE` (set by the workflow; do not hardcode).

## 3. Deploy the site

1. Repo Settings → Pages → Source: **GitHub Actions** (once).
2. Push to `demo/browser-only` — `.github/workflows/demo-pages.yml` builds
   (`npm ci && GITHUB_PAGES_BASE=/<repo>/ npm run build`) and deploys.
3. Site goes live at `https://<org>.github.io/<repo>/` (HTTPS ⇒ WebGPU
   secure-context requirement is satisfied).

## 4. Post-deploy checklist

- [ ] Status pill shows the model loading with a progress bar (weights pull
      from HF on first visit; browser Cache Storage makes later visits instant)
- [ ] Chrome: WebLLM engine (`[llm] webllm done in …s (schema-constrained)` in
      console), scribe returns terse `field_summaries` JSON on first attempt
- [ ] Safari: transformers.js engine (WebLLM needs
      `maxStorageBuffersPerShaderStage ≥ 10`; Safari/Firefox expose 9)
- [ ] ASR: `[asr] parakeet profile: fp16/subgroups` (Apple/Chrome) or
      `fp16/portable` (Intel iGPU) and a ~20-45× real-time transcription
- [ ] Streaming capture (ambient scribe): per-utterance `[asr] parakeet done:`
      lines during recording, `Diarize … -> S1/S2` speaker labels with the
      colored dots in the live caption card and final transcript, and at the
      40-word warm cadence `[llm] warm prefill: Nt (M new, K cached)` +
      `[llm] seeding from warm cache` at stop on the transformers.js engine,
      or (WebLLM, second recording onwards) `[llm] webllm capture preload` at
      record start + `[llm] webllm warm: prompt prefilled (engine prefix reuse)`
- [ ] Settings → model radio group offers exactly the two size presets
      (0.8B / 2B) + Custom…, each with its one-line explanation — no engine
      choices (the engine falls back silently)

## Notes & gotchas

- **Bumping the model**: re-run the training-repo pipeline (see
  `train-phlox/AGENTS.md`) and `hf upload` into the same repos (Cache Storage
  keys by URL; unchanged filenames will be revalidated — bump a version dir
  name inside the repo if you need a forced refresh for users).
- **Costs**: bandwidth from HF is free and CDN-cached; the site itself is
  static. First-visit download is ~440MB (WebLLM set) on Chrome.
- **Firefox**: parakeet works (slower first-run shader compile); the LLM falls
  back to the transformers.js wasm path. Fine for demos; recommend Chrome.
- Dev machines can keep a `public/models/parakeet/` symlink (gitignored) to
  serve the ASR packages over the LAN instead — see `DEMO.md`. The LLM always
  streams from HF.
