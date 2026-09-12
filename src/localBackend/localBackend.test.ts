// Behavioral smoke test for the browser-only demo local backend.
// Mocks only the model layer (llm/asr); router, db, defaults, scribe prompt
// construction and letter formatting run for real against jsdom localStorage.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, ChatOptions } from "./llm";

const chatMock = vi.fn<(messages: ChatMessage[], options: ChatOptions) => Promise<string>>();
const isModelReadyMock = vi.fn<() => boolean>(() => false);

vi.mock("./llm", () => ({
  chat: (...args: unknown[]) => chatMock(...(args as [ChatMessage[], ChatOptions])),
  isModelReady: () => isModelReadyMock(),
  onStatus: vi.fn(() => () => {}),
  invalidateModel: vi.fn(),
}));
const transcribeMock = vi.fn<(blob: Blob) => Promise<{ text: string; duration: number }>>();
const AsrErrorMock = vi.hoisted(
  () =>
    class AsrError extends Error {
      constructor() {
        super("Local transcription failed");
      }
    },
);

vi.mock("./asr", () => ({
  transcribe: (...args: unknown[]) => transcribeMock(...(args as [Blob])),
  AsrError: AsrErrorMock,
  ASR_PRESETS: [
    { id: "onnx-community/whisper-base.en", label: "whisper-base.en (default)" },
  ],
}));
import { handleLocalRequest, onDocumentProgress } from "./router";
import { buildDemoExport } from "./db";
import { buildExtractionSchema, parseFieldSummaries } from "./scribe";

interface FieldLike {
  field_key: string;
  required?: boolean;
}

interface TemplateLike {
  template_key: string;
  template_name: string;
  fields: FieldLike[];
}

// vitest's jsdom environment exposes a method-less localStorage stub; the
// demo store only touches it lazily inside calls, so a real in-memory
// implementation installed here is sufficient.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: new MemoryStorage(),
});

interface RowLike {
  id: number;
  name: string;
  ur_number: string;
  encounter_date: string;
  template_key: string;
  template_data: Record<string, string>;
  [key: string]: unknown;
}

interface FieldsResponse {
  fields: Record<string, string>;
  rawTranscription: string;
  transcriptionDuration: number;
  processDuration: number;
}

function form(pairs: Record<string, string | Blob>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(pairs)) formData.append(key, value);
  return formData;
}

async function json<T = unknown>(
  url: string,
  options?: { method?: string; body?: unknown },
): Promise<{ status: number; body: T }> {
  const response = await handleLocalRequest(url, {
    method: options?.method ?? "GET",
    body: options?.body,
    headers:
      typeof options?.body === "string" ? { "Content-Type": "application/json" } : undefined,
  });
  return { status: response.status, body: (await response.json()) as T };
}

function saveRequest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    patientData: {
      first_name: "Test",
      last_name: "Patient",
      dob: "1980-05-15",
      gender: "M",
      ur_number: "UR1",
      encounter_date: "2026-09-01",
      template_key: "phlox_01",
      template_data: { impression: "Stable CLL on surveillance.", plan: "1. Repeat FBE" },
      ...overrides,
    },
  });
}

describe("local backend route table", () => {
  beforeEach(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("phlox_demo_")) localStorage.removeItem(key);
    }
    chatMock.mockReset();
    isModelReadyMock.mockReturnValue(false);
    transcribeMock.mockReset();
  });

  it("serves boot config: user settings, global consent flag, auth wildcard", async () => {
    const user = await json<{ has_completed_splash_screen: boolean; scribe_is_ambient: boolean }>(
      "/api/config/user",
    );
    expect(user.status).toBe(200);
    expect(user.body.has_completed_splash_screen).toBe(true);
    expect(user.body.scribe_is_ambient).toBe(true);

    const global = await json("/api/config/global");
    expect(global.body).toEqual({
      REQUIRE_SCRIBE_CONSENT: true,
      DOCUMENT_IMAGE_PROCESSING_MODE: "auto",
      VISION_MODEL_CAPABLE: true,
    });

    const auth = await json("/api/auth/me");
    expect(auth.body).toEqual({ authenticated: true });

    const status = await json<{ status: string }>("/api/config/status");
    expect(status.body.status).toBe("ok");
  });

  it("extracts demographics from document text and reports vision capability", async () => {
    expect((await json("/api/chat/vision-capability/current")).body).toMatchObject({
      vision_capable: true,
    });
    expect((await json("/api/chat/vision-capability", { method: "POST", body: "{}" })).body).toMatchObject({
      vision_capable: true,
      status_code: 200,
    });

    chatMock.mockResolvedValueOnce(
      '```json\n{"first_name": "Jane", "last_name": "Smith", "dob": "1980-05-15", "gender": "female", "ur_number": "UR42", "address": null, "phone": "", "junk": "x"}\n```',
    );
    const demo = await json<Record<string, string>>("/api/transcribe/extract-demographics-from-text", {
      method: "POST",
      body: JSON.stringify({ extracted_text: "Jane Smith DOB 15/05/1980" }),
    });
    expect(demo.body).toEqual({
      first_name: "Jane",
      last_name: "Smith",
      dob: "1980-05-15",
      gender: "F",
      ur_number: "UR42",
    });
    const [messages] = chatMock.mock.calls[0];
    expect(messages[0].content).toContain("Do not guess or infer.");
  });

  it("chunks documents, streams progress, and merges fields", async () => {
    chatMock
      .mockResolvedValueOnce('{"field_summaries": {"clinical_history": ["page one point"]}}')
      .mockResolvedValueOnce('{"field_summaries": {"clinical_history": ["page two point"], "plan": ["book scan"]}}');
    const events: Array<[number, number]> = [];
    const unsubscribe = onDocumentProgress((done, total) => events.push([done, total]));

    const doc = `${"Para one. ".repeat(60)}\n\n${"Para two. ".repeat(60)}\n\n${"Para three. ".repeat(60)}`;
    const res = await json<FieldsResponse>("/api/transcribe/process-document-from-text", {
      method: "POST",
      body: JSON.stringify({ extracted_text: doc, templateKey: "phlox_01" }),
    });
    unsubscribe();

    expect(res.status).toBe(200);
    expect(chatMock).toHaveBeenCalledTimes(2); // three paragraphs packed into two ~1500-char chunks
    expect(events).toEqual([[1, 2], [2, 2]]);
    // Merged across chunks: bullets concatenated per field.
    expect(res.body.fields.clinical_history).toBe("- Page one point\n- Page two point");
    expect(res.body.fields.plan).toBe("1. Book scan");
    // Every call stays small for the local model.
    for (const [messages] of chatMock.mock.calls) {
      expect(String(messages[1].content).length).toBeLessThanOrEqual(1600);
    }
  });

  it("surfaces a GPU-memory remedy when the model run fails", async () => {
    chatMock.mockRejectedValue(
      new Error("failed to call OrtRun(). ERROR_CODE: 1, ERROR_MESSAGE: webgpu_context.cc WebGPU device error(3): Out of memory"),
    );
    const failed = await json<{ detail: string }>("/api/transcribe/reprocess", {
      method: "POST",
      body: form({ transcript_text: "t", templateKey: "phlox_01" }),
    });
    expect(failed.status).toBe(500);
    expect(failed.body.detail).toContain("0.8B preset");
  });

  it("maps a total ASR failure to an honest transcription detail", async () => {
    transcribeMock.mockRejectedValue(new AsrErrorMock());
    const failed = await json<{ detail: string }>("/api/transcribe/dictate", {
      method: "POST",
      body: form({ file: new Blob(["wav"]) }),
    });
    expect(failed.status).toBe(500);
    expect(failed.body.detail).toBe("Local transcription failed on this device");
  });

  it("serves clinical templates and default template persistence", async () => {
    const templates = await json<TemplateLike[]>("/api/templates");
    expect(templates.body).toHaveLength(5);
    expect(templates.body[0].template_key).toBe("phlox_01");
    const plan = templates.body[0].fields.find((field) => field.field_key === "plan");
    expect(plan?.required).toBe(true);

    expect((await json("/api/templates/default")).body).toEqual({ template_key: "phlox_01" });

    await json("/api/templates/default/soap_01", { method: "POST" });
    expect((await json("/api/templates/default")).body).toEqual({ template_key: "soap_01" });

    const one = await json<TemplateLike>("/api/templates/soap_01");
    expect(one.body.template_name).toBe("SOAP Note");
    expect((await json("/api/templates/nope_99")).status).toBe(404);
  });

  it("saves, fetches, lists, searches and deletes notes", async () => {
    const saved = await json<RowLike>("/api/note/save", {
      method: "POST",
      body: saveRequest({ template_data: { impression: "Stable CLL on surveillance." } }),
    });
    expect(saved.status).toBe(200);
    expect(saved.body.id).toBe(1);
    expect(saved.body.name).toBe("Patient, Test");

    const fetched = await json<RowLike>("/api/note/id/1");
    expect(fetched.body.template_data.impression).toBe("Stable CLL on surveillance.");
    expect((await json("/api/note/id/999")).status).toBe(404);

    const listed = await json<Record<string, unknown>[]>(
      "/api/note/list?date=2026-09-01&detailed=true",
    );
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ id: 1, name: "Patient, Test", ur_number: "UR1" });
    const searched = await json("/api/note/search?q=test");
    expect(searched.body).toHaveLength(1);

    expect((await json("/api/note/summary/1")).body).toEqual({ summary: "" });
    expect((await json("/api/note/incomplete-jobs-count")).body).toEqual({ incomplete_jobs_count: 0 });

    expect((await json("/api/note/id/1", { method: "DELETE" })).body).toEqual({ success: true });
    expect((await json("/api/note/id/1")).status).toBe(404);
  });

  it("serves letter templates, persistence and generation context trimming", async () => {
    await json("/api/note/save", { method: "POST", body: saveRequest() });

    const templates = await json<{ default_template_id: number; templates: { name: string }[] }>(
      "/api/letter/templates",
    );
    expect(templates.body.default_template_id).toBe(1);
    expect(templates.body.templates.map((template) => template.name)).toEqual([
      "GP Letter",
      "Specialist Referral",
      "Discharge Summary",
      "Brief Update",
    ]);

    await json("/api/letter/save", {
      method: "POST",
      body: JSON.stringify({ noteId: 1, letter: "Dear Doctor," }),
    });
    expect((await json("/api/letter/fetch-letter?noteId=1")).body).toEqual({ letter: "Dear Doctor," });
    expect((await json("/api/letter/fetch-letter?noteId=42")).body).toEqual({ letter: "" });

    const userSettings = await json<{ name: string }>("/api/config/user");
    expect(userSettings.body.name).toBe("");

    chatMock.mockResolvedValueOnce("Dear Doctor, regards.");
    const context: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "assistant" : "user",
      content: `msg-${i}`,
    }));

    const generated = await json<{ letter: string; context: ChatMessage[] }>(
      "/api/letter/generate",
      {
        method: "POST",
        body: JSON.stringify({
          patientName: "Patient, Test",
          gender: "M",
          dob: "1980-05-15",
          template_data: { impression: "Stable CLL on surveillance." },
          additional_instruction: "Keep it brief.",
          context,
        }),
      },
    );
    expect(generated.body.letter).toBe("Dear Doctor, regards.");

    const [messages, options] = chatMock.mock.calls[0];
    expect(options.temperature).toBe(0.6);
    expect(messages).toHaveLength(1 + 1 + 1 + 8); // system + instruction + patient + last 8 context
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("professional medical correspondence writer");
    expect(messages[0].content).not.toContain("voice of");
    expect(messages[1].content).toBe(
      "Before we proceed with the task; please take note of the following additional instructions:\nKeep it brief.",
    );
    expect(messages[2].content).toContain("Patient Name: Patient, Test");
    expect(messages[2].content).toContain("Gender: M");
    expect(messages[2].content).toMatch(/Age: 4[56]/);
    expect(messages[2].content).toContain("Clinic Note:");
    expect(messages[2].content).toContain("Impression:\nStable CLL on surveillance.");
    expect(messages[3].content).toBe("msg-2"); // last 8 of 10
    expect(generated.body.context).toHaveLength(8);

    // Doctor settings flow into the system prompt voice.
    await json("/api/config/user", {
      method: "POST",
      body: JSON.stringify({ name: "Dr Jane Smith", specialty: "Haematology" }),
    });
    chatMock.mockResolvedValueOnce("letter2");
    await json("/api/letter/generate", {
      method: "POST",
      body: JSON.stringify({
        patientName: "Patient, Test",
        gender: "M",
        dob: "1980-05-15",
        template_data: { impression: "x" },
      }),
    });
    const secondSystem = chatMock.mock.calls[1][0][0].content;
    expect(secondSystem).toContain("Write the letter in the voice of Dr Jane Smith, a Haematology specialist.");
  });

  it("transcribes dictation and reprocesses transcripts into bullet fields", async () => {
    transcribeMock.mockResolvedValueOnce({ text: "hello world", duration: 1.25 });
    const dictated = await json<{ transcription: string; transcriptionDuration: number }>(
      "/api/transcribe/dictate",
      { method: "POST", body: form({ file: new Blob(["audio"]) }) },
    );
    expect(dictated.body).toEqual({ transcription: "hello world", transcriptionDuration: 1.25 });

    chatMock.mockResolvedValueOnce(
      '{"field_summaries": {"clinical_history": ["presents for review"], "plan": ["repeat FBE", "follow up"]}}',
    );
    const reprocessed = await json<FieldsResponse>("/api/transcribe/reprocess", {
      method: "POST",
      body: form({
        transcript_text: "patient presents for review",
        name: "Patient, Test",
        gender: "M",
        dob: "1980-05-15",
        templateKey: "phlox_01",
        isAmbient: "true",
        original_transcription_duration: "3.5",
      }),
    });
    expect(reprocessed.status).toBe(200);
    expect(reprocessed.body.rawTranscription).toBe("patient presents for review");
    expect(reprocessed.body.fields.clinical_history).toBe("- Presents for review");
    expect(reprocessed.body.fields.plan).toBe("1. Repeat FBE\n2. Follow up");
    // persistent fields (primary_history etc.) are never extracted
    expect(reprocessed.body.fields.primary_history).toBeUndefined();

    const [messages, options] = chatMock.mock.calls[0];
    expect(options.temperature).toBe(0.1);
    expect(options.max_new_tokens).toBe(1024);
    expect(options.jsonSchema).toContain('"clinical_history"');
    expect(options.jsonSchema).toContain('"plan"');
    expect(options.jsonSchema).toContain('"additionalProperties":false');
    expect(messages[0].content).toContain(
      "Extract relevant information for each of the following fields from the medical transcript.",
    );
    expect(messages[0].content).toContain("Patient name: Test Patient");
    expect(messages[0].content).toContain("Gender: M");
    expect(messages[0].content).toContain("DOB: 1980-05-15");
    expect(messages[0].content).toContain("FIELD: clinical_history");
    expect(messages[0].content).toContain(
      'Output MUST be ONLY valid JSON with top-level key "field_summaries"',
    );
    expect(messages[1]).toEqual({ role: "user", content: "patient presents for review" });
  });

  it("ambient scribe route runs ASR then extraction with primary condition context", async () => {
    await json("/api/note/save", {
      method: "POST",
      body: saveRequest({ primary_condition: "chronic lymphocytic leukaemia", template_data: {} }),
    });

    transcribeMock.mockResolvedValueOnce({ text: "transcript text", duration: 2 });
    chatMock.mockResolvedValueOnce('{"field_summaries": {"clinical_history": ["well"]}}');

    const result = await json<FieldsResponse>("/api/transcribe/audio", {
      method: "POST",
      body: form({
        file: new Blob(["audio"]),
        name: "Patient, Test",
        gender: "M",
        dob: "1980-05-15",
        templateKey: "phlox_01",
        isAmbient: "true",
        noteId: "1",
      }),
    });
    expect(result.status).toBe(200);
    expect(result.body.rawTranscription).toBe("transcript text");
    expect(result.body.transcriptionDuration).toBe(2);
    expect(result.body.fields.clinical_history).toBe("- Well");
    expect(chatMock.mock.calls[0][0][0].content).toContain(
      " This is a returning patient who sees the clinician for chronic lymphocytic leukaemia.",
    );
  });

  it("retries once on bad extraction JSON, then fails with backend detail", async () => {
    chatMock.mockResolvedValueOnce("no json here").mockResolvedValueOnce('{"field_summaries": {"plan": ["do x"]}}');

    const ok = await json<FieldsResponse>("/api/transcribe/reprocess", {
      method: "POST",
      body: form({ transcript_text: "t", templateKey: "phlox_01" }),
    });
    expect(ok.status).toBe(200);
    expect(ok.body.fields.plan).toBe("1. Do x");
    expect(chatMock).toHaveBeenCalledTimes(2);

    chatMock.mockResolvedValue("still no json");
    const failed = await json("/api/transcribe/reprocess", {
      method: "POST",
      body: form({ transcript_text: "t", templateKey: "phlox_01" }),
    });
    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({ detail: "Error processing transcription" });
  });

  it("accepts bare field mapping without the field_summaries wrapper (markdown-fenced)", async () => {
    // Real 2B-model output observed in the demo: no wrapper, extra junk key,
    chatMock.mockResolvedValueOnce(
      '```json\n{"clinical_history": ["well today"], "junk_key": ["ignored"], "plan": "repeat FBE"}\n```',
    );
    const res = await json<FieldsResponse>("/api/transcribe/reprocess", {
      method: "POST",
      body: form({ transcript_text: "t", templateKey: "phlox_01" }),
    });
    expect(res.status).toBe(200);
    expect(res.body.fields.clinical_history).toBe("- Well today");
    expect(res.body.fields.plan).toBe("1. Repeat FBE");
    expect(res.body.fields.junk_key).toBeUndefined();
    expect(res.body.fields.impression).toBeUndefined(); // persistent fields are not extraction targets
  });

  it("treats an extraction with no recognized fields as a failure (triggers retry)", async () => {
    chatMock.mockResolvedValueOnce('{"field_summaries": {"unknown_field": ["x"]}}');
    const failed = await json("/api/transcribe/reprocess", {
      method: "POST",
      body: form({ transcript_text: "t", templateKey: "phlox_01" }),
    });
    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({ detail: "Error processing transcription" });
  });

  it("tracks scribe consent per UR number", async () => {
    interface ConsentState {
      scribe_consent_at: string | null;
      scribe_consent_declined_at: string | null;
    }

    expect(await json("/api/note/consent?ur_number=UR9")).toEqual({
      status: 200,
      body: { scribe_consent_at: null, scribe_consent_declined_at: null },
    });

    const granted = await json<ConsentState>("/api/note/consent", {
      method: "POST",
      body: JSON.stringify({ ur_number: "UR9", consented: true }),
    });
    expect(granted.body.scribe_consent_at).toBeTruthy();
    expect(granted.body.scribe_consent_declined_at).toBeNull();

    const declined = await json<ConsentState>("/api/note/consent", {
      method: "POST",
      body: JSON.stringify({ ur_number: "UR9", consented: false }),
    });
    expect(declined.body.scribe_consent_at).toBeNull();
    expect(declined.body.scribe_consent_declined_at).toBeTruthy();

    const reread = await json<ConsentState>("/api/note/consent?ur_number=UR9");
    expect(reread.body).toEqual(declined.body);
  });

  it("extracts jobs via LLM, falls back to heuristic split on bad JSON", async () => {
    isModelReadyMock.mockReturnValue(true);
    chatMock.mockResolvedValueOnce(
      '```json\n{"action_items": [{"text": "Book PET scan", "category": "action", "rationale": null}, {"text": "", "category": "action", "rationale": null}], "excluded": []}\n```',
    );
    const llm = await json<{ action_items: { text: string }[]; fallback: string | null }>(
      "/api/note/extract-jobs",
      { method: "POST", body: JSON.stringify({ plan: "1. Book PET scan 2. Review in MDT" }) },
    );
    expect(llm.body.fallback).toBeNull();
    expect(llm.body.action_items).toEqual([{ text: "Book PET scan", category: "action", rationale: null }]);

    chatMock.mockResolvedValueOnce("total garbage, no json");
    const heuristic = await json<{ action_items: { text: string }[]; fallback: string | null }>(
      "/api/note/extract-jobs",
      { method: "POST", body: JSON.stringify({ plan: "1. Check CBC\n2. Refer to derm\n\n" }) },
    );
    expect(heuristic.body.fallback).toBe("heuristic");
    expect(heuristic.body.action_items.map((item) => item.text)).toEqual(["Check CBC", "Refer to derm"]);

    // Model not loaded: heuristic split is the normal path — no fallback flag,
    // so the wrap-up modal never shows its "unavailable" banner.
    isModelReadyMock.mockReturnValue(false);
    const offline = await json<{ action_items: { text: string }[]; fallback: string | null }>(
      "/api/note/extract-jobs",
      { method: "POST", body: JSON.stringify({ plan: "1. Check CBC\n2. Refer to derm" }) },
    );
    expect(offline.body.fallback).toBeNull();
    expect(offline.body.action_items.map((item) => item.text)).toEqual(["Check CBC", "Refer to derm"]);

    const empty = await json<{ action_items: unknown[]; fallback: string | null }>(
      "/api/note/extract-jobs",
      { method: "POST", body: JSON.stringify({ plan: "   " }) },
    );
    expect(empty.body).toEqual({ action_items: [], excluded: [], fallback: "empty" });
  });

  it("exports the full demo dataset as an importable envelope", async () => {
    await json("/api/note/save", { method: "POST", body: saveRequest() });
    await json("/api/note/update-jobs-list", {
      method: "POST",
      body: JSON.stringify({
        noteId: 1,
        jobsList: [
          { id: 1, job: "Repeat FBE", completed: false },
        ],
      }),
    });
    await json("/api/letter/save", {
      method: "POST",
      body: JSON.stringify({ noteId: 1, letter: "Dear Doctor," }),
    });

    const exported = buildDemoExport();
    expect(exported.format).toBe("phlox-demo-export");
    expect(exported.version).toBe(1);
    expect(typeof exported.exported_at).toBe("string");
    expect(exported.user.has_completed_splash_screen).toBe(true);
    expect(exported.patients).toHaveLength(1);
    const row = exported.patients[0];
    expect(row).toMatchObject({
      id: 1,
      first_name: "Test",
      last_name: "Patient",
      name: "Patient, Test",
      ur_number: "UR1",
      encounter_date: "2026-09-01",
      template_key: "phlox_01",
      final_letter: "Dear Doctor,",
    });
    expect(row.template_data.plan).toBe("1. Repeat FBE");
    // jobs_list exports as a native array for direct backend import
    expect(row.jobs_list).toEqual([{ id: 1, job: "Repeat FBE", completed: false }]);
  });

  it("serves outstanding jobs, counts incomplete, and persists job completion", async () => {
    // Plain save never writes jobs (wrap-up flow owns job curation).
    await json("/api/note/save", { method: "POST", body: saveRequest() });
    expect((await json("/api/note/incomplete-jobs-count")).body).toEqual({ incomplete_jobs_count: 0 });
    expect(await json("/api/note/outstanding-jobs")).toEqual({ status: 200, body: [] });

    const jobs = [
      { id: 1, job: "Check CBC", completed: false },
      { id: 2, job: "Refer to derm", completed: false },
    ];
    const updated = await json<{ id: number }>("/api/note/update-jobs-list", {
      method: "POST",
      body: JSON.stringify({ noteId: 1, jobsList: jobs }),
    });
    expect(updated.body).toEqual({ id: 1 });

    expect((await json("/api/note/incomplete-jobs-count")).body).toEqual({ incomplete_jobs_count: 2 });
    const outstanding = await json<
      { id: number; name: string; jobs_list: string; encounter_date: string; reasoning: unknown }[]
    >("/api/note/outstanding-jobs");
    expect(outstanding.body).toHaveLength(1);
    expect(outstanding.body[0]).toMatchObject({ id: 1, name: "Patient, Test", encounter_date: "2026-09-01", reasoning: null });
    expect(JSON.parse(outstanding.body[0].jobs_list)).toEqual(jobs);

    // Complete every job -> no longer outstanding, count drops to zero.
    await json("/api/note/update-jobs-list", {
      method: "POST",
      body: JSON.stringify({ noteId: 1, jobsList: jobs.map((job) => ({ ...job, completed: true })) }),
    });
    expect((await json("/api/note/incomplete-jobs-count")).body).toEqual({ incomplete_jobs_count: 0 });
    expect(await json("/api/note/outstanding-jobs")).toEqual({ status: 200, body: [] });

    // Detailed day list serializes the stored jobs list too.
    const detailed = await json<{ jobs_list: string }[]>("/api/note/list?date=2026-09-01&detailed=true");
    expect(JSON.parse(detailed.body[0].jobs_list)).toHaveLength(2);
  });

  it("404s on unknown routes", async () => {
    const res = await json("/api/unknown/endpoint");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ detail: "not implemented" });
  });
});

describe("scribe extraction schema and key-drift tolerance", () => {
  const field = (key: string, name: string) => ({ field_key: key, field_name: name }) as never;

  it("builds a strict schema requiring every field key", () => {
    const schema = JSON.parse(
      buildExtractionSchema([field("clinical_history", "Current History"), field("plan", "Plan")] as never),
    ) as {
      properties: { field_summaries: Record<string, unknown> };
      required: string[];
      additionalProperties: boolean;
    };
    const summary = schema.properties.field_summaries;
    expect(Object.keys(summary.properties as object)).toEqual(["clinical_history", "plan"]);
    expect(summary.required).toEqual(["clinical_history", "plan"]);
    expect(summary.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["field_summaries"]);
    expect(schema.additionalProperties).toBe(false);
  });

  it("maps snake_cased field names back to their field keys", () => {
    const fields = [field("primary_history", "Primary Medical History"), field("clinical_history", "Current History")];
    const parsed = parseFieldSummaries('{"field_summaries": {"current_history": ["Stable"]}}', fields as never);
    expect(parsed).toEqual({ clinical_history: ["Stable"] });
  });

  it("drops keys that resolve to nothing", () => {
    const fields = [field("plan", "Plan")];
    const parsed = parseFieldSummaries('{"field_summaries": {"current_history": ["x"], "plan": ["y"]}}', fields as never);
    expect(parsed).toEqual({ plan: ["y"] });
  });
});
