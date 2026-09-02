# Browser-only tech demo (transformers.js, localStorage)

## Context

Port phlox to a pure in-browser tech demo on a new branch (`demo/browser-only`): the Python/SQLCipher backend is replaced by an in-browser TS "backend" persisted to localStorage, and letter generation runs on a local model via `@huggingface/transformers` (WebGPU, WASM fallback). Scope: patients/encounters + correspondence (letters) with the built-in templates only. No chat, clinical reasoning, RAG, transcription/dictation, document extraction, jobs/wrap-up, PDF forms. Existing Chakra UI is kept; all existing api modules keep working unchanged.

Key mechanism: `universalFetch` (single transport choke-point used by every api module) is intercepted and served by a local route table returning real `Response` objects — zero changes to api call sites, toasts, and error paths.

## Approach

### 1. Branch + dependency
- `git checkout -b demo/browser-only` from current default-branch HEAD.
- `npm install @huggingface/transformers` (v3 line, `^3`). Dev on this branch runs `npm run start-react` (vite only, :3000) — never `npm run dev` (no uvicorn).

### 2. New `src/localBackend/` (TS, the "backend")
- `defaults.ts` — port verbatim to TS constants:
  - Clinical templates: all entries from `server/database/config/defaults/templates.py` `get_default_templates()` (`template_key`, `template_name`, `fields[]` with `field_key/field_name/field_type/persistent/required/system_prompt/initial_prompt/format_schema/refinement_rules/style_example`).
  - Letter templates: `server/database/config/defaults/letters.py` — the 4 (`GP Letter`, `Specialist Referral`, `Discharge Summary`, `Brief Update`) with their `instructions` strings (expand the `...` truncations by reading the source file), plus the `Dictation` template.
  - Prompts: `letter` and `summary` system prompts from `server/database/config/defaults/prompts.py`; letter temperature `0.6`, summary temperature `0.1`.
- `db.ts` — localStorage JSON store, key prefix `phlox_demo_`: `phlox_demo_patients` (array, autoincrement `id` starting 1), `phlox_demo_user_settings` (default `{ has_completed_splash_screen: true, name: "", specialty: "" }`), `phlox_demo_default_template_key` (default `"phlox_01"`), `phlox_demo_default_letter_template_id` (default `1`), `phlox_demo_model` (default preset, see step 6). Load-with-defaults + save helpers; no migration needed (demo).
- `llm.ts` — transformers.js manager:
  - Lazy `await import("@huggingface/transformers")`; set `env.allowLocalModels = false` (use HF CDN).
  - `ensureModel(onProgress?)` → cached `pipeline("text-generation", modelId, { device, dtype, progress_callback })`; `device = navigator.gpu ? "webgpu" : "wasm"`; dtype `q4f16` on WebGPU, `q4` on WASM. Switching model id drops the cache and reloads.
  - `chat(messages, { temperature, max_new_tokens = 768 })` → `generator(messages, { temperature, do_sample: temperature > 0, max_new_tokens })`, return last message content string.
  - Export a tiny pub/sub `onStatus(cb)` with states `{ state: "idle" | "loading" | "ready" | "error", progress?, modelId, error? }` consumed by the status pill.
- `letter.ts` — port of `server/nlp_tools/letter.py:generate_letter_content` minus the JSON wrapper (small local models handle plain text more reliably — deliberate deviation):
  - system = letter system prompt + `"Write the letter in the voice of {name}, a {specialty} specialist."` when user settings present.
  - If `additional_instruction`: user message `Before we proceed with the task; please take note of the following additional instructions:\n{...}` (exact backend wording).
  - user message: `Patient Name: ...\nGender: ...\nAge: {calculateAge(dob)}\n\nClinic Note:\n{formatted template_data}` where clinic note = `"\n\n".join("{Field Name Title}:\n{value}")` for non-empty values (title-case the field key, underscores→spaces — as backend).
  - context: trim to last 8 messages (replaces backend token-budget truncation), non-system only.
  - `calculateAge(dob)` port: full years between dob and today; `"N/A"` on parse failure.
  - Returns `{ letter, context }`.
- `router.ts` — `handleLocalRequest(url, options): Promise<Response>`. Match method + `URL` pathname; JSON body via `new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } })`. Route table (exact response shapes mirror the FastAPI handlers, verified against frontend consumers):

  | Request | Response |
  |---|---|
  | GET `/api/config/user` | user settings object (incl. `has_completed_splash_screen: true`) |
  | POST `/api/config/user` | merge body into user settings, `{ success: true }` |
  | POST `/api/config/user/mark_splash_complete` | `{ success: true }` |
  | GET `/api/templates` | array of clinical template objects |
  | GET `/api/templates/default` | `{ template_key }` |
  | POST `/api/templates/default/{key}` | persist, `{ success: true }` |
  | GET `/api/note/list?date=&detailed=` | basic: `[{ id, name, ur_number }]`; detailed adds `jobs_list: "[]"`, `encounter_summary`, `dob`, `reasoning: null` — filter by `encounter_date === date` |
  | GET `/api/note/search?q=` | rows matching name/ur substring (case-insensitive) |
  | GET `/api/note/id/{id}` | stored row (404 `{ detail: "Patient not found" }` if missing) |
  | DELETE `/api/note/id/{id}` | remove, `{ success: true }` |
  | POST `/api/note/save` | upsert body `{ patientData }`; normalize `name = `${first_name} ${last_name}`` while keeping both fields; keep `template_data` as object; if `encounter_summary` empty and model ready → fire-and-forget summary generation (summary prompt, one sentence) that updates the stored row; return the full stored row **including `id`** (frontend navigates to `/note/${savedPatient.id}`) |
  | GET `/api/note/summary/{id}` | object with the summary field the consumer reads — grep `fetchPatientSummary(` consumer in `src/components/patient/PatientInfoBar.jsx` first and mirror its field name (default `{ encounter_summary }`) |
  | GET `/api/note/incomplete-jobs-count` | `{ count: 0 }` |
  | GET `/api/letter/templates` | `{ templates: [{ id, name, instructions }], default_template_id }` |
  | GET `/api/letter/fetch-letter?noteId=` | `{ letter: row.final_letter ?? "" }` |
  | POST `/api/letter/save` | store `letter` → row `final_letter`, `{ success: true }` |
  | POST `/api/letter/generate` | `{ letter, context }` from `letter.ts` (awaits `ensureModel`; errors → status 500 `{ detail }`) |
  | any `/api/auth/*` GET | 200 `{ authenticated: true }` |
  | anything else | 404 `{ detail: "not implemented" }` + `console.warn("[localBackend] unhandled", method, path)` — this warning is the verification loop for missed stubs |

### 3. Transport swap
`src/utils/helpers/apiHelpers.jsx` `universalFetch`: at top, `if (DEMO_BACKEND) return handleLocalRequest(url, options);` with `const DEMO_BACKEND = true;` (branch constant). No other api-layer changes except: `src/utils/api/letterApi.ts` `generateLetter` gets `timeout: 600000` in its `handleApiRequest` (model download/generation can exceed the 120s default).

### 4. Feature strip (UI)
- `src/utils/helpers/featureFlags.js`: `isChatEnabled()` and `isRagEnabled()` → return false (this alone hides RAG nav, chat/reasoning/document buttons in `FloatingActionMenu`, and any flag-gated panels).
- `src/components/layout/AppRoutes.jsx`: remove `/rag`, `/clinic-summary`, `/outstanding-jobs` routes + imports.
- `src/components/sidebar/SidebarNavigation.jsx`: remove the All Jobs and (flag already hides RAG) Documents items — keep New Note + Settings.
- `src/components/common/FloatingActionMenu.jsx`: reduce to the Letter button only (strip Previous Visit — not flag-gated).
- `src/pages/PatientDetails.jsx`: remove Chat, ReasoningPanel, TranscriptionPanel, DocumentPanel, PreviousVisitPanel, WrapUpModal, Scribe pieces (`Scribe`, `ScribePillBox`, `ScribeConsentModal`, `useTranscriptionCapture`, `useScribeConsent`, `useWrapUp`, `useDocumentExtraction`) + their JSX/props/hook calls; keep PatientInfoBar, NewNoteStartCard, Summary, Letter panel, DemographicsModal, save flow (`usePatientEditor`), `useActivePanel`, `useModificationFlags`.
- `src/components/patient/Summary.jsx`: remove the Wrap-Up button/`onWrapUp` prop path; keep template select + field editors.
- `src/components/panels/letter/LetterPanel.jsx`: remove dictation mode (the `FaMicrophone` mode toggle + `DictationWidget`).
- `src/pages/LandingPage.jsx`: replace `DashboardChat` with a simple welcome panel (app title, "New Note" CTA, today's encounters via `patientApi.fetchNoteList({ date: today })`); keep `DisclaimerModal`.
- `src/pages/Settings.jsx`: replace page body with new `src/components/settings/DemoSettingsPanel.tsx`: model preset `NativeSelect` (`Qwen2.5-0.5B-Instruct` → `onnx-community/Qwen2.5-0.5B-Instruct`, `Qwen2.5-1.5B-Instruct` (default) → `onnx-community/Qwen2.5-1.5B-Instruct`, `Custom…` → free-text HF repo id), "Load model" button with progress bar (`llm.onStatus`), doctor name + specialty inputs (POST `/api/config/user` — feeds the letter voice), storage usage line, and "Reset demo data" (clears all `phlox_demo_*` keys, reloads).

### 5. Model status UI
New `src/components/common/ModelStatusPill.tsx`: fixed top-right pill subscribing to `llm.onStatus` — states: "Model: not loaded" (click → `/settings`), "Downloading 43%", "Ready (webgpu)". Mount in `App.jsx` `AppContent` return (outside routes, `position: fixed`, high z-index).

## Critical files & anchors
- `src/utils/helpers/apiHelpers.jsx` — `universalFetch` intercept (the whole demo hangs off this).
- `src/localBackend/router.ts` (new) — route table is the backend contract; shapes above verified against `src/utils/api/*` and `server/api/{patient,letter,templates}.py`.
- `src/pages/PatientDetails.jsx` — densest strip; reread before editing (546 lines, many interwoven hooks).
- `server/nlp_tools/letter.py:67-169` + `server/database/config/defaults/*.py` — sources to port verbatim into `letter.ts`/`defaults.ts`.
- `src/utils/hooks/useLetter.jsx` — consumes `{ letter, context }` and template fallback logic; do not change.

## Verification
Prereq: branch checked out, `npm install` done. Run `npm run start-react` (hub start, ready on :3000). Browser-drive end-to-end:
1. App boots straight past splash (no login/encryption gate) — any `[localBackend] unhandled` warning in console is a missing stub → add per table.
2. New Note → fill demographics (name/DOB/UR/gender) + template fields on `phlox_01` → Save → URL becomes `/note/{id}`, encounter appears in sidebar for today.
3. Letter panel → pick "GP Letter" → Generate: model downloads (pill + progress), then a letter renders referencing the patient and note content.
4. Refine ("make it shorter") → letter updates (context round-trip).
5. Edit letter text → Save → reload page → letter and encounter persist (localStorage).
6. Sidebar search finds the patient by name; Settings shows model Ready + doctor name persists after reload and influences a regenerated letter's signature line.
7. `npm run typecheck` and `npm run build` both pass.

## Assumptions & contingencies
- Default model `onnx-community/Qwen2.5-1.5B-Instruct` (preset-switchable in settings); ~1 GB one-time download, cached by the browser. If load is too slow for demo taste, switch preset to 0.5B in settings — no code change.
- No WebGPU → automatic WASM fallback (slower; pill shows device). No code change.
- `/api/note/save` response: full stored row is a superset of every consumer (verified consumers use `id` and spread).
- If a stripped-panel import is still referenced somewhere unexpected (build error), delete the referencing JSX block too — the strip list above is the intended final surface, not a strict diff.
- transformers.js ONNX wasm binaries load from the jsdelivr CDN by default — demo requires network on first model load; no bundling of wasm attempted.
