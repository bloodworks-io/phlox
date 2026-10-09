# Deploying the browser-only demo (GitHub Pages + Hugging Face)

The demo is 100% static: GitHub Pages serves the app shell (~2MB); model
weights are far too large for GitHub (100MB/file, 1GB/site limits) and are
hosted on the **Hugging Face Hub**, which every engine in this app loads from
natively over CORS.

## Architecture at deploy time

| artifact | size | hosted at | loaded by |
|---|---|---|---|
| app shell (vite build) | ~2MB | GitHub Pages (`demo-pages.yml` auto-deploys on push to `demo/browser-only`) | — |
| `phlox-0.8b-MLC` (WebLLM q4f16 package) | ~433MB | HF repo `bloodworks-io/phlox-0.8b-MLC` | WebLLM path (Chrome/Edge) |
| `phlox-0.8b-ONNX` (transformers.js package) | ~600MB (q4 + q8 sets) | HF repo `bloodworks-io/phlox-0.8b-ONNX` | transformers.js fallback (Safari/Firefox) |
| parakeet ASR packages | 405/441MB | parakeet.wgsl project CDN (or your own HF mirror) | parakeet path (any WebGPU browser) |
| WebLLM model lib (`phlox-0.8b-webgpu.wasm`) | 6MB | inside the MLC repo (also shipped by mlc's official lib CDN as fallback) | WebLLM |
| CAM++ speaker diarizer (`campplus-zh-en.onnx`) | 28MB | committed in-repo at `public/models/campplus-zh-en.onnx` (gitignore exception — no HF mirror) | capture diarization (`speakers.ts`) |

Runtime URL selection: LLM weights always come from the HF repos configured
in `src/localBackend/llm.ts` (`HF_ORG`) — the app never serves an LLM mirror.
The ASR HEAD-probes `/models/parakeet/*` on its own origin first (dev mirror)
and falls back to the parakeet CDN in `asr.ts`. No build-time configuration
required.

## 1. Upload weights to Hugging Face (once per model version)

From the training box (`train-phlox`), with `hf` authenticated
(`hf auth login`, write access to the org):

```bash
# WebLLM package (converted weights + wasm + configs)
hf upload bloodworks-io/phlox-0.8b-MLC dist/phlox-0.8b-q4f16-1-MLC . --repo-type model

# transformers.js package (all dtype variants + tokenizer; excludes fp32/q4 decoder bulk if space matters)
hf upload bloodworks-io/phlox-0.8b-ONNX out/onnx-tjs/phlox-0.8b . --repo-type model
```

Set both repos to **public** (Settings tab). HF serves every file with
`Access-Control-Allow-Origin: *`, which is all the engines need.

Optional: mirror the parakeet packages under
`bloodworks-io/parakeet-mirror/{fp16,fp32}` and point `asr.ts`
`resolveParakeetModelUrls` at HF — otherwise the project CDN is used.

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
- [ ] Settings → model radio group lists the tuned phlox presets first, each
      with its one-line explanation

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
