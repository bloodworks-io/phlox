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
| parakeet ASR packages | 405/441MB | HF repo `bloodworks-io/parakeet-wgsl-v1` (byte-exact mirror of the parakeet.wgsl package) | parakeet path (any WebGPU browser) |
| WebLLM model libs (`phlox-{0.8b,2b}-webgpu.wasm`) | 6MB each | inside the MLC repos | WebLLM |
| CAM++ speaker diarizer (`campplus-zh-en.onnx`) | 28MB | committed in-repo at `public/models/campplus-zh-en.onnx` (gitignore exception — no HF mirror) | capture diarization (`speakers.ts`) |

Runtime URL selection: LLM weights always come from the HF repos configured
in `src/localBackend/llm.ts` (`HF_ORG`) — the app never serves an LLM mirror.
The ASR HEAD-probes `/models/parakeet/*` on its own origin first (dev mirror)
and falls back to the HF mirror in `asr.ts` — the package's third-party
default CDN is never reached. No build-time configuration required.

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

The parakeet mirror (`bloodworks-io/parakeet-wgsl-v1`) is a byte-exact copy of
the canonical `parakeet-wgsl-models.narcotic.sh` packages — the runtime
verifies manifest and per-file SHA-256s, so an exact mirror on any CORS host
satisfies it. `parakeet.wgsl` is pinned to an exact version in `package.json`;
a version bump can change the canonical hashes, at which point re-mirror
(canonical URLs + hashes live in the parakeet.wgsl repo's `model/README.md`):

```bash
base=https://parakeet-wgsl-models.narcotic.sh/v1
for prec in fp16 fp32; do
  sha=<manifest sha256 from model/README.md>
  mkdir -p mirror/$prec/$sha
  (cd mirror/$prec/$sha &&
   curl -fO $base/$prec/$sha/manifest.json &&
   jq -r '.files[].name' manifest.json | xargs -P6 -I{} curl -fO $base/$prec/$sha/{})
done
hf upload bloodworks-io/parakeet-wgsl-v1 mirror/fp16 fp16 --repo-type model
hf upload bloodworks-io/parakeet-wgsl-v1 mirror/fp32 fp32 --repo-type model
```

Then update `HF_PARAKEET_MANIFESTS` in `src/localBackend/asr.ts`.

The packages are modified forms of NVIDIA Parakeet TDT 0.6B v2 (CC BY 4.0) —
hosting the mirror redistributes them, so the repo carries attribution: a
README + THIRD_PARTY_LICENSES at the repo root (NVIDIA source model + pinned
revision, parakeet.wgsl repack credit). Keep them when re-mirroring.

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
