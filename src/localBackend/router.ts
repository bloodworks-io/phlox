// Local route table for the browser-only demo. handleLocalRequest mirrors the
// FastAPI response shapes verified against src/utils/api/* consumers.

import {
  DEFAULT_TEMPLATES,
  DEFAULT_LETTER_TEMPLATES,
  DEFAULT_OPTIONS,
  PROMPTS,
  type ClinicalTemplate,
  type TemplateField,
} from "./defaults";
import {
  getPatients,
  getPatientById,
  upsertPatient,
  updatePatientFields,
  getUserSettings,
  saveUserSettings,
  getDefaultTemplateKey,
  setDefaultTemplateKey,
  getDefaultLetterTemplateId,
  setDefaultLetterTemplateId,
  getConsent,
  setConsent,
  nextPatientId,
  savePatients,
  type StoredPatient,
  getModelId,
} from "./db";
import { isModelReady, chat } from "./llm";
import type { ChatMessage } from "./llm";
import { transcribe, AsrError } from "./asr";
import { formatPatientDisplayName, processTranscription, TranscriptionProcessingError, extractFields } from "./scribe";
import { generateLetterContent } from "./letter";

export interface LocalRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function notFound(detail: string): Response {
  return jsonResponse({ detail }, 404);
}

async function readJsonBody(options: LocalRequestOptions): Promise<Record<string, unknown>> {
  if (typeof options.body !== "string" || options.body.length === 0) return {};
  try {
    return JSON.parse(options.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function templateByKey(key: string): ClinicalTemplate | undefined {
  return DEFAULT_TEMPLATES.find((template) => template.template_key === key);
}

function fieldsForKey(key: string | null): TemplateField[] {
  if (!key) return [];
  return templateByKey(key)?.fields ?? [];
}

/** server/utils/helpers.py:format_name — display name convention is "Last, First". */
function formatDisplayName(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const last = lastName.trim();
  if (last && first) return `${last}, ${first}`;
  return last || first;
}

function listRow(patient: StoredPatient): Record<string, unknown> {
  return {
    id: patient.id,
    name: patient.name,
    ur_number: patient.ur_number,
    jobs_list: JSON.stringify(Array.isArray(patient.jobs_list) ? patient.jobs_list : []),
    encounter_summary: patient.encounter_summary ?? "",
    dob: patient.dob,
    reasoning: null,
  };
}

/**
 * Extract actionable jobs from a plan (server/api/patient.py extract_jobs port).
 * LLM first (job_extraction prompt); heuristic line-split fallback on failure.
 */
export async function extractJobsFromPlan(
  plan: string,
): Promise<{ action_items: { text: string; category: string; rationale: string | null }[]; excluded: unknown[]; fallback: string | null }> {
  const trimmed = plan.trim();
  const heuristic = () =>
    trimmed
      .split("\n")
      .map((line) => line.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean)
      .map((text) => ({ text, category: "action", rationale: null }));

  if (!trimmed) return { action_items: [], excluded: [], fallback: "empty" };

  // Model not loaded: heuristic line-split is the expected demo path (no
  // surprise multi-GB download, no "unavailable" banner). Model loaded but
  // unusable output: same split, flagged as a genuine fallback.
  const modelReady = isModelReady();
  if (modelReady) {
    try {
      const content = await chat(
        [
          {
            role: "system",
            content: `${PROMPTS.job_extraction.system}\n\nReturn ONLY valid JSON with this top-level shape:\n{"action_items": [{"text": "...", "category": "action", "rationale": "..."}], "excluded": [{"text": "...", "category": "follow_up", "rationale": "..."}]}`,
          },
          { role: "user", content: trimmed },
        ],
        { temperature: 0.1, max_new_tokens: 512 },
      );
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start >= 0 && end > start) {
        const parsed = JSON.parse(content.slice(start, end + 1)) as {
          action_items?: { text?: string }[];
        };
        const items = (parsed.action_items ?? [])
          .filter((item) => typeof item.text === "string" && item.text.trim())
          .map((item) => ({ text: item.text!.trim(), category: "action", rationale: null }));
        if (items.length > 0) {
          return { action_items: items, excluded: [], fallback: null };
        }
      }
    } catch (error) {
      console.warn("[localBackend] job extraction LLM failed, using heuristic split:", error);
    }
  }
  return { action_items: heuristic(), excluded: [], fallback: modelReady ? "heuristic" : null };
}


function errorResponse(error: unknown): Response {
  if (error instanceof TranscriptionProcessingError) {
    return jsonResponse({ detail: "Error processing transcription" }, 500);
  }
  if (error instanceof AsrError) {
    // ASR failed on both devices (root causes logged by asr.ts) — don't offer
    // the LLM preset remedy here, it doesn't apply to whisper.
    return jsonResponse({ detail: "Local transcription failed on this device" }, 500);
  }
  console.error("[localBackend] handler error:", error);
  // GPU-kernel failures are common on small GPUs with the bigger presets —
  // surface the actual remedy instead of a generic 500.
  const message = String(error);
  if (/Out of memory|Integer overflow|buffer/i.test(message)) {
    return jsonResponse(
      {
        detail:
          "Local model ran out of GPU memory — switch to the 0.8B preset in Settings, or use a shorter document",
      },
      500,
    );
  }
  return jsonResponse({ detail: "Internal server error" }, 500);
}

async function handleTranscribeAudio(options: LocalRequestOptions): Promise<Response> {
  const form = options.body as FormData;
  const file = form.get("file");
  if (!(file instanceof Blob)) return jsonResponse({ detail: "file is required" }, 400);

  const name = form.get("name");
  const gender = form.get("gender");
  const dob = form.get("dob");
  const templateKey = form.get("templateKey");
  const isAmbient = String(form.get("isAmbient") ?? "true") !== "false";
  const noteIdRaw = form.get("noteId");

  const transcription = await transcribe(file);

  let primaryCondition: string | null = null;
  if (noteIdRaw) {
    const existing = getPatientById(Number(noteIdRaw));
    primaryCondition = existing?.primary_condition ?? null;
  }

  const result = await processTranscription(
    transcription.text,
    fieldsForKey(typeof templateKey === "string" ? templateKey : null),
    {
      name: formatPatientDisplayName(typeof name === "string" ? name : null),
      dob: typeof dob === "string" ? dob : null,
      gender: typeof gender === "string" ? gender : null,
    },
    isAmbient,
    primaryCondition,
  );

  return jsonResponse({
    fields: result.fields,
    rawTranscription: transcription.text,
    transcriptionDuration: transcription.duration,
    processDuration: result.process_duration,
  });
}

async function handleTranscribeReprocess(options: LocalRequestOptions): Promise<Response> {
  const form = options.body as FormData;
  const transcriptText = String(form.get("transcript_text") ?? "");
  const name = form.get("name");
  const gender = form.get("gender");
  const dob = form.get("dob");
  const templateKey = form.get("templateKey");
  const isAmbient = String(form.get("isAmbient") ?? "true") !== "false";
  const noteIdRaw = form.get("noteId");
  const originalDuration = Number(form.get("original_transcription_duration") ?? 0);

  let primaryCondition: string | null = null;
  if (noteIdRaw) {
    const existing = getPatientById(Number(noteIdRaw));
    primaryCondition = existing?.primary_condition ?? null;
  }

  const result = await processTranscription(
    transcriptText,
    fieldsForKey(typeof templateKey === "string" ? templateKey : null),
    {
      name: formatPatientDisplayName(typeof name === "string" ? name : null),
      dob: typeof dob === "string" ? dob : null,
      gender: typeof gender === "string" ? gender : null,
    },
    isAmbient,
    primaryCondition,
  );

  return jsonResponse({
    fields: result.fields,
    rawTranscription: transcriptText,
    transcriptionDuration: Number.isFinite(originalDuration) ? originalDuration : 0,
    processDuration: result.process_duration,
  });
}

async function handleSaveNote(options: LocalRequestOptions): Promise<Response> {
  const body = await readJsonBody(options);
  const patientData = body.patientData as Partial<StoredPatient> | undefined;
  if (!patientData) return jsonResponse({ detail: "patientData is required" }, 400);

  const patients = getPatients();
  const existingId = typeof patientData.id === "number" ? patientData.id : null;
  const now = new Date().toISOString();

  const row: StoredPatient = {
    ...patientData,
    id: existingId ?? nextPatientId(patients),
    first_name: patientData.first_name ?? "",
    last_name: patientData.last_name ?? "",
    name: formatDisplayName(patientData.first_name ?? "", patientData.last_name ?? ""),
    dob: patientData.dob ?? "",
    gender: patientData.gender ?? "",
    ur_number: patientData.ur_number ?? "",
    encounter_date: patientData.encounter_date ?? "",
    template_key: patientData.template_key ?? getDefaultTemplateKey(),
    template_data: (patientData.template_data as Record<string, string>) ?? {},
    raw_transcription: patientData.raw_transcription ?? null,
    transcription_duration: patientData.transcription_duration ?? null,
    process_duration: patientData.process_duration ?? null,
    final_letter: patientData.final_letter ?? null,
    encounter_summary: patientData.encounter_summary ?? null,
    primary_condition: patientData.primary_condition ?? null,
    jobs_list: (patientData.jobs_list as StoredPatient["jobs_list"]) ?? [],
    created_at: existingId !== null ? getPatientById(existingId)?.created_at ?? now : now,
    updated_at: now,
  };

  const saved = upsertPatient(row);
  return jsonResponse(saved);
}

async function handleGenerateLetter(options: LocalRequestOptions): Promise<Response> {
  const body = await readJsonBody(options);
  try {
    const result = await generateLetterContent({
      patientName: String(body.patientName ?? ""),
      gender: (body.gender as string) ?? null,
      dob: (body.dob as string) ?? null,
      template_data: (body.template_data as Record<string, unknown>) ?? {},
      additional_instruction: (body.additional_instruction as string) ?? null,
      context: (body.context as ChatMessage[]) ?? null,
    });
    return jsonResponse(result);
  } catch (error) {
    console.error("[localBackend] letter generation failed:", error);
    return jsonResponse({ detail: "Error generating letter content" }, 500);
  }
}

const DEMOGRAPHICS_KEYS = ["first_name", "last_name", "dob", "gender", "ur_number", "address", "phone"] as const;

// Small models (and ort's int32 WebGPU kernels) choke on huge prompts — a
// 10 KB document overflowed OrtRun, 6 KB OOM'd a small GPU. Keep the head:
// referrals front-load the content that matters (header, demographics, reason).
function capDocumentText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  console.warn(`[localBackend] document text truncated ${text.length} -> ${maxChars} chars for local model`);
  return `${text.slice(0, maxChars)}\n\n[document truncated]`;
}

// --- chunked document processing progress (consumed by DocumentPanel) ---
export type DocumentProgressListener = (done: number, total: number) => void;
let documentProgressListener: DocumentProgressListener | null = null;

export function onDocumentProgress(listener: DocumentProgressListener): () => void {
  documentProgressListener = listener;
  return () => {
    documentProgressListener = null;
  };
}

/** Split document text into small (~1500 char) paragraph-aligned chunks. */
export function chunkDocumentText(text: string, chunkChars = 1500): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of text.split(/\n{2,}/)) {
    if (current && current.length + paragraph.length > chunkChars) {
      chunks.push(current);
      current = "";
    }
    current += current ? `\n\n${paragraph}` : paragraph;
  }
  if (current.trim()) chunks.push(current);
  return chunks.filter((chunk) => chunk.trim());
}

/**
 * One LLM call to pull demographics from document text (verbatim backend
 * prompt); tolerant JSON parse, populated-fields-only like the backend.
 */
async function extractDemographics(text: string, images: string[] = []): Promise<Record<string, string>> {
  const capped = capDocumentText(text, 3000); // demographics live on page one
  const system =
    "Extract the patient's demographic details from the provided document text. " +
    "Return ONLY valid JSON with these keys: " +
    "first_name, last_name, dob (ISO YYYY-MM-DD when determinable), " +
    "gender (single letter 'M' or 'F' when stated), ur_number, address, phone. " +
    "Use null for any field not present in the document. Do not guess or infer.";
  const content = await chat(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: images.length
          ? [...images.map(() => ({ type: "image" as const })), { type: "text" as const, text: capped || "Extract the patient's demographics from the document images." }]
          : capped || "(no text)",
      },
    ],
    { temperature: 0.1, max_new_tokens: 256, images: images.length ? images : undefined },
  );

  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("demographics extraction returned no JSON");
  const parsed = JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;

  const result: Record<string, string> = {};
  for (const key of DEMOGRAPHICS_KEYS) {
    const value = parsed[key];
    if (typeof value !== "string" || !value.trim()) continue;
    if (key === "gender") {
      const normalized = value.trim().toUpperCase()[0];
      if (normalized === "M" || normalized === "F") result.gender = normalized;
      continue;
    }
    result[key] = value.trim();
  }
  return result;
}
export async function handleLocalRequest(url: string, options: LocalRequestOptions = {}): Promise<Response> {
  const parsed = new URL(url, window.location.origin);
  const path = parsed.pathname;
  const method = (options.method ?? "GET").toUpperCase();
  const segments = path.split("/").filter(Boolean); // ["api", ...]
  const formBody = options.body instanceof FormData;

  try {
    if (path === "/api/config/status" && method === "GET") {
      return jsonResponse({ status: "ok", demo: true });
    }
    // --- config ---
    if (path === "/api/config/user" && method === "GET") {
      return jsonResponse(getUserSettings());
    }

    if (path === "/api/config/user" && method === "POST") {
      const body = await readJsonBody(options);
      saveUserSettings({ ...getUserSettings(), ...body });
      return jsonResponse({ success: true });
    }
    if (path === "/api/config/user/mark_splash_complete" && method === "POST") {
      saveUserSettings({ ...getUserSettings(), has_completed_splash_screen: true });
      return jsonResponse({ success: true });
    }
    if (path === "/api/config/global" && method === "GET") {
      // VISION_MODEL_CAPABLE: false — visual document processing removed; the
      // fine-tuned text model never receives images. Frontend degrades to the
      // text-layer path via this flag + the capability endpoints below.
      return jsonResponse({
        REQUIRE_SCRIBE_CONSENT: true,
        DOCUMENT_IMAGE_PROCESSING_MODE: "auto",
        VISION_MODEL_CAPABLE: false,
      });
    }
    if (path === "/api/config/options" && method === "GET") {
      return jsonResponse(DEFAULT_OPTIONS);
    }

    // --- auth (any) ---
    if (segments[0] === "api" && segments[1] === "auth" && method === "GET") {
      return jsonResponse({ authenticated: true });
    }

    // --- clinical templates ---
    if (path === "/api/templates" && method === "GET") {
      return jsonResponse(DEFAULT_TEMPLATES);
    }
    if (path === "/api/templates/default" && method === "GET") {
      return jsonResponse({ template_key: getDefaultTemplateKey() });
    }
    if (segments[0] === "api" && segments[1] === "templates" && segments[2] === "default" && segments[3] && method === "POST") {
      setDefaultTemplateKey(segments[3]);
      return jsonResponse({ success: true });
    }
    if (segments[0] === "api" && segments[1] === "templates" && segments[2] && segments[2] !== "default" && method === "GET") {
      const template = templateByKey(segments[2]);
      if (!template) return notFound("Template not found");
      return jsonResponse(template);
    }

    // --- notes / patients ---
    if (path === "/api/note/list" && method === "GET") {
      const date = parsed.searchParams.get("date") ?? "";
      const detailed = parsed.searchParams.get("detailed") === "true";
      const rows = getPatients()
        .filter((patient) => !date || patient.encounter_date === date)
        .map((patient) => (detailed ? listRow(patient) : { id: patient.id, name: patient.name, ur_number: patient.ur_number }));
      return jsonResponse(rows);
    }
    if (path === "/api/note/history" && method === "GET") {
      // Template-change pre-fill: encounters of the same template family, newest first.
      const urNumber = parsed.searchParams.get("ur_number") ?? "";
      const templateBase = parsed.searchParams.get("template_key") ?? "";
      const rows = getPatients()
        .filter((patient) => patient.ur_number === urNumber)
        .filter(
          (patient) =>
            patient.template_key === templateBase ||
            patient.template_key.startsWith(`${templateBase}_`),
        )
        .sort((a, b) => (b.encounter_date ?? "").localeCompare(a.encounter_date ?? ""));
      return jsonResponse(rows);
    }
    if (path === "/api/note/search" && method === "GET") {
      const query = (parsed.searchParams.get("q") ?? "").toLowerCase();
      const rows = query
        ? getPatients().filter(
            (patient) =>
              patient.name?.toLowerCase().includes(query) ||
              patient.ur_number?.toLowerCase().includes(query),
          )
        : [];
      return jsonResponse(rows);
    }
    if (segments[0] === "api" && segments[1] === "note" && segments[2] === "id" && segments[3]) {
      const id = Number(segments[3]);
      if (method === "GET") {
        const row = getPatientById(id);
        if (!row) return notFound("Patient not found");
        return jsonResponse(row);
      }
      if (method === "DELETE") {
        savePatients(getPatients().filter((patient) => patient.id !== id));
        return jsonResponse({ success: true });
      }
    }
    if (path === "/api/note/save" && method === "POST") {
      return await handleSaveNote(options);
    }
    if (segments[0] === "api" && segments[1] === "note" && segments[2] === "summary" && segments[3] && method === "GET") {
      const row = getPatientById(Number(segments[3]));
      if (!row) return notFound("Patient not found");
      return jsonResponse({ summary: row.encounter_summary ?? "" });
    }
    if (path === "/api/note/incomplete-jobs-count" && method === "GET") {
      const count = getPatients().reduce(
        (sum, patient) =>
          sum + (Array.isArray(patient.jobs_list) ? patient.jobs_list.filter((job) => !job.completed).length : 0),
        0,
      );
      return jsonResponse({ incomplete_jobs_count: count });
    }
    if (path === "/api/note/outstanding-jobs" && method === "GET") {
      const rows = getPatients()
        .filter(
          (patient) =>
            Array.isArray(patient.jobs_list) && patient.jobs_list.some((job) => !job.completed),
        )
        .map((patient) => ({
          ...listRow(patient),
          encounter_date: patient.encounter_date,
        }));
      return jsonResponse(rows);
    }
    if (path === "/api/note/update-jobs-list" && method === "POST") {
      const body = await readJsonBody(options);
      const noteId = Number(body.noteId);
      updatePatientFields(noteId, { jobs_list: (body.jobsList as StoredPatient["jobs_list"]) ?? [] });
      return jsonResponse({ id: noteId });
    }
    if (path === "/api/note/extract-jobs" && method === "POST") {
      const body = await readJsonBody(options);
      const result = await extractJobsFromPlan(String(body.plan ?? ""));
      return jsonResponse(result);
    }
    if (path === "/api/note/consent" && method === "GET") {
      const urNumber = parsed.searchParams.get("ur_number") ?? "";
      return jsonResponse(getConsent(urNumber));
    }
    if (path === "/api/note/consent" && method === "POST") {
      const body = await readJsonBody(options);
      const urNumber = String(body.ur_number ?? "");
      const consented = Boolean(body.consented);
      return jsonResponse(setConsent(urNumber, consented));
    }

    // --- letters ---
    if (path === "/api/letter/templates" && method === "GET") {
      return jsonResponse({
        templates: DEFAULT_LETTER_TEMPLATES,
        default_template_id: getDefaultLetterTemplateId(),
      });
    }
    if (segments[0] === "api" && segments[1] === "letter" && segments[2] === "templates" && segments[3] && method === "GET") {
      const template = DEFAULT_LETTER_TEMPLATES.find((item) => item.id === Number(segments[3]));
      if (!template) return notFound("Letter template not found");
      return jsonResponse(template);
    }
    if (segments[0] === "api" && segments[1] === "letter-templates" && segments[2] === "default" && segments[3] && method === "POST") {
      setDefaultLetterTemplateId(Number(segments[3]));
      return jsonResponse({ success: true });
    }
    if (path === "/api/letter/fetch-letter" && method === "GET") {
      const noteId = Number(parsed.searchParams.get("noteId"));
      const row = getPatientById(noteId);
      return jsonResponse({ letter: row?.final_letter ?? "" });
    }
    if (path === "/api/letter/save" && method === "POST") {
      const body = await readJsonBody(options);
      const noteId = Number(body.noteId);
      updatePatientFields(noteId, { final_letter: String(body.letter ?? "") });
      return jsonResponse({ success: true });
    }
    if (path === "/api/letter/generate" && method === "POST") {
      return await handleGenerateLetter(options);
    }

    // --- transcription ---
    if (path === "/api/transcribe/audio" && method === "POST" && formBody) {
      return await handleTranscribeAudio(options);
    }
    if (path === "/api/transcribe/dictate" && method === "POST" && formBody) {
      const form = options.body as FormData;
      const file = form.get("file");
      if (!(file instanceof Blob)) return jsonResponse({ detail: "file is required" }, 400);
      const transcription = await transcribe(file);
      return jsonResponse({
        transcription: transcription.text,
        transcriptionDuration: transcription.duration,
      });
    }
    if (path === "/api/transcribe/reprocess" && method === "POST" && formBody) {
      return await handleTranscribeReprocess(options);
    }

    // --- documents ---
    if (path === "/api/transcribe/process-document-from-text" && method === "POST") {
      const body = await readJsonBody(options);
      const extractedText = String(body.extracted_text ?? "").trim();
      if (!extractedText) return jsonResponse({ detail: "No extracted_text provided" }, 400);

      const fields = fieldsForKey(String(body.templateKey ?? ""));
      const patientContext = {
        name: formatPatientDisplayName((body.name as string) ?? null),
        dob: (body.dob as string) ?? null,
        gender: (body.gender as string) ?? null,
      };
      const introOverride = "Extract relevant information for each field from the provided medical document.";

      // Chunk by paragraph so each call stays small for the local model; the
      // merged result keeps one bullet list per field across chunks.
      const chunks = chunkDocumentText(capDocumentText(extractedText, 12000));
      const started = performance.now();
      const merged: Record<string, string> = {};
      for (const [index, chunk] of chunks.entries()) {
        const result = await extractFields(chunk, fields, patientContext, false, null, { introOverride });
        for (const [key, value] of Object.entries(result)) {
          if (value) merged[key] = merged[key] ? `${merged[key]}\n${value}` : value;
        }
        documentProgressListener?.(index + 1, chunks.length);
      }
      return jsonResponse({
        fields: merged,
        rawTranscription: "",
        transcriptionDuration: 0,
        processDuration: Number(((performance.now() - started) / 1000).toFixed(2)),
      });
    }
    if (path === "/api/transcribe/process-document-visual" && method === "POST") {
      // Visual document processing removed: localBackend is text-only now
      // (fine-tuned text model; vision tower unused). Text-layer path above remains.
      return jsonResponse({ detail: "Visual document processing is not available in this demo" }, 410);
    }

    // --- demographics extraction (documentProcessing.py:_extract_demographics_from_text port) ---
    if (path === "/api/transcribe/extract-demographics-from-text" && method === "POST") {
      const body = await readJsonBody(options);
      const text = String(body.extracted_text ?? "");
      return jsonResponse(await extractDemographics(text));
    }
    if (path === "/api/transcribe/extract-demographics-visual" && method === "POST") {
      return jsonResponse({ detail: "Visual demographics extraction is not available in this demo" }, 410);
    }
    if (path === "/api/transcribe/extract-demographics" && method === "POST" && formBody) {
      const file = (options.body as FormData).get("file");
      if (!(file instanceof Blob)) return jsonResponse({ detail: "file is required" }, 400);
      if (file.type !== "text/plain") {
        return jsonResponse(
          { detail: "Demo reads text-layer documents in the browser; drop a PDF with a text layer or an image" },
          422,
        );
      }
      return jsonResponse(await extractDemographics(await file.text()));
    }

    // --- vision capability (text-only demo: always false) ---
    if (path === "/api/chat/vision-capability/current" && method === "GET") {
      return jsonResponse({ vision_capable: false, model: getModelId(), probed_at: null });
    }
    if (path === "/api/chat/vision-capability" && method === "POST") {
      return jsonResponse({ vision_capable: false, status_code: 410, detail: "Text-only demo" });
    }
  } catch (error) {
    return errorResponse(error);
  }

  console.warn("[localBackend] unhandled", method, path);
  return jsonResponse({ detail: "not implemented" }, 404);
}
