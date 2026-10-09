// Port of server/transcription/capture.py: streaming capture sessions for
// Ambient and Dictate modes.
//
// Browser divergences:
//  - no config manager: streaming capture is always enabled; KV warming runs
//    only when the model is loaded on WebGPU (wasm prefill cannot keep up
//    with live capture, and remote-billing concerns do not apply in-page);
//  - token counts are chars/4 approximations (no cl100k in the browser);
//  - the llama.cpp raw strict-prefix warm becomes the DynamicCache prefill
//    exposed by llm.ts prefillMessages()/chat({seedCache}).

import type { TemplateField } from "./defaults";
import { currentModelDevice, isModelReady, modelQueueDepth, prefillMessages } from "./llm";
import { buildExtractionMessages, processTranscription, type PatientContext } from "./scribe";
import { createSessionSpeakers, formatSegment, type SessionSpeakers } from "./speakers";
import { intakeUtterance } from "./intake";

const ENDED_RETENTION_SECONDS = 15 * 60; // keep finished sessions briefly for stop() re-reads
const IDLE_TIMEOUT_SECONDS = 2 * 60 * 60; // abandon sessions with no activity for 2h

export const WARM_MIN_WORDS = 40;

// Stop warming once the transcript exceeds this many tokens.
export const WARM_MAX_TRANSCRIPT_TOKENS = 16_000;

export const FINAL_DRAIN_SECONDS = 30;

export function streamingCaptureEnabled(): boolean {
  // Demo ships its own local model stack — the bundled-local default is "on".
  return true;
}

export function kvWarmingEnabled(): boolean {
  return isModelReady() && currentModelDevice() === "webgpu";
}

export class CaptureSession {
  /** In-memory state for one ambient/dictate streaming capture. */
  id: string;
  mode: "ambient" | "dictate";
  templateKey: string | null;
  templateFields: TemplateField[];
  patientContext: PatientContext;
  primaryCondition: string | null;
  noteId: number | null;
  createdAt = Date.now();
  lastActivity = Date.now();
  endedAt: number | null = null;
  transcriptSegments: string[] = [];

  // Running approximate token count of the transcript.
  transcriptTokens = 0;

  // Cumulative ASR engine time
  sttSeconds = 0;

  failedSegments = 0;
  wordsSinceWarm = 0;

  speakers: SessionSpeakers | null;
  // Python audio_lock: utterance intake serialized per session.
  audioChain: Promise<void> = Promise.resolve();
  warmTask: Promise<void> | null = null;
  tasks = new Set<Promise<unknown>>();
  // Set by the stop route; a repeat stop returns it unchanged.
  stopResult: Record<string, unknown> | null = null;

  constructor(options: {
    id: string;
    mode: "ambient" | "dictate";
    templateKey: string | null;
    templateFields: TemplateField[];
    patientContext: PatientContext;
    primaryCondition: string | null;
    noteId: number | null;
    speakers: SessionSpeakers | null;
  }) {
    this.id = options.id;
    this.mode = options.mode;
    this.templateKey = options.templateKey;
    this.templateFields = options.templateFields;
    this.patientContext = options.patientContext;
    this.primaryCondition = options.primaryCondition;
    this.noteId = options.noteId;
    this.speakers = options.speakers;
  }

  touch(): void {
    this.lastActivity = Date.now();
  }

  end(): void {
    if (this.endedAt === null) this.endedAt = Date.now();
  }

  get isEnded(): boolean {
    return this.endedAt !== null;
  }

  get isAmbient(): boolean {
    return this.mode === "ambient";
  }

  trackTask(task: Promise<unknown>): void {
    this.tasks.add(task);
    void task.finally(() => this.tasks.delete(task));
  }

  transcriptText(): string {
    return this.transcriptSegments.join("\n");
  }
}

/** Registry of active capture sessions with lazy TTL pruning. */
class CaptureManager {
  private sessions = new Map<string, CaptureSession>();

  private prune(): void {
    const now = Date.now();
    const stale = [...this.sessions.entries()]
      .filter(
        ([, session]) =>
          (session.isEnded && session.endedAt !== null && now - session.endedAt > ENDED_RETENTION_SECONDS * 1000) ||
          now - session.lastActivity > IDLE_TIMEOUT_SECONDS * 1000,
      )
      .map(([id]) => id);
    for (const id of stale) {
      console.info(`Pruning capture session ${id} (idle/ended)`);
      this.sessions.delete(id);
    }
  }

  create(options: {
    mode: "ambient" | "dictate";
    templateKey: string | null;
    templateFields: TemplateField[];
    patientContext: PatientContext;
    primaryCondition?: string | null;
    noteId?: number | null;
  }): CaptureSession {
    this.prune();
    const session = new CaptureSession({
      id: crypto.randomUUID().replace(/-/g, ""),
      speakers: options.mode === "ambient" ? createSessionSpeakers() : null,
      mode: options.mode,
      templateKey: options.templateKey,
      templateFields: options.templateFields,
      patientContext: options.patientContext,
      primaryCondition: options.primaryCondition ?? null,
      noteId: options.noteId ?? null,
    });
    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): CaptureSession | null {
    this.prune();
    const session = this.sessions.get(sessionId) ?? null;
    if (session !== null) session.touch();
    return session;
  }
}

export const captureManager = new CaptureManager();

// --- live partial transcript events (consumer: ScribePillBox) ---

export interface CaptureSegmentEvent {
  sessionId: string;
  speaker: string | null;
  text: string;
  /** Words captured so far in the session. */
  words: number;
}

export type CaptureSegmentListener = (event: CaptureSegmentEvent) => void;
let captureSegmentListener: CaptureSegmentListener | null = null;

export function onCaptureSegment(listener: CaptureSegmentListener): () => void {
  captureSegmentListener = listener;
  return () => {
    captureSegmentListener = null;
  };
}

/** Intake one utterance: transcribe, label (ambient), append, maybe warm. */
export function handleAudio(session: CaptureSession, blob: Blob): Promise<void> {
  if (session.isEnded) return Promise.resolve();
  session.touch();
  const run = session.audioChain.then(async () => {
    if (session.isEnded) return;
    let speaker: string | null;
    let text: string;
    let sttDuration: number;
    try {
      ({ speaker, text, duration: sttDuration } = await intakeUtterance(blob, session.speakers));
    } catch (error) {
      session.failedSegments += 1;
      console.error(`Capture session ${session.id}: transcription failed: ${error}`);
      return;
    }
    if (!text) {
      console.info(`Capture session ${session.id}: transcription returned no text; skipping segment`);
      return;
    }
    const segment = formatSegment(speaker, text);
    session.transcriptSegments.push(segment);
    session.wordsSinceWarm += text.split(/\s+/).filter(Boolean).length;
    session.sttSeconds += sttDuration;
    session.transcriptTokens += countTokens(segment);
    try {
      captureSegmentListener?.({
        sessionId: session.id,
        speaker,
        text,
        words: session.transcriptSegments.reduce((sum, line) => sum + line.split(/\s+/).filter(Boolean).length, 0),
      });
    } catch (error) {
      console.error(`Capture session ${session.id}: segment listener failed: ${error}`);
    }
  });
  session.audioChain = run.catch(() => {});
  session.trackTask(run);
  void run.then(() => {
    if (warmingDue(session)) scheduleWarm(session);
  });
  return run;
}

function countTokens(text: string): number {
  // cl100k approximation for English clinical text (no tiktoken in-page).
  return Math.ceil(text.length / 4);
}

function warmingDue(session: CaptureSession): boolean {
  if (session.isEnded) return false;
  if (!kvWarmingEnabled()) return false;
  if (session.wordsSinceWarm < WARM_MIN_WORDS) return false;
  return session.transcriptTokens <= WARM_MAX_TRANSCRIPT_TOKENS;
}

function scheduleWarm(session: CaptureSession): void {
  if (session.warmTask !== null) {
    // A warm is in flight; leave the word counter so the next utterance retries.
    return;
  }
  // Browser divergence: an idle model queue is required so a warm never
  // delays a fresh utterance transcription.
  if (modelQueueDepth() > 0) return;
  session.wordsSinceWarm = 0;
  session.warmTask = warm(session).finally(() => {
    session.warmTask = null;
  });
  session.trackTask(session.warmTask);
}

async function warm(session: CaptureSession): Promise<void> {
  /** Prefill the extraction prompt prefix with the transcript so far. */
  try {
    // KV prefix dies at the first differing FIELDS block if not byte identical.
    const fields = session.templateFields.filter((field) => !field.persistent);
    const messages = buildExtractionMessages(session.transcriptText(), fields, session.patientContext, {
      isAmbient: session.isAmbient,
      primaryCondition: session.primaryCondition,
    });
    await prefillMessages(messages);
  } catch (error) {
    console.debug(`Capture session ${session.id}: warm-up skipped (${error})`);
  }
}

/** Wait (bounded) for in-flight utterance/warm tasks to settle. */
export async function drain(session: CaptureSession, timeout: number = FINAL_DRAIN_SECONDS): Promise<void> {
  const pending = [...session.tasks];
  if (pending.length === 0) return;
  await Promise.race([
    Promise.allSettled(pending),
    new Promise((resolve) => setTimeout(resolve, timeout * 1000)),
  ]);
  if (session.tasks.size > 0) {
    console.warn(`Capture session ${session.id}: ${session.tasks.size} task(s) still running after drain`);
  }
}

/** Run the regular batch pipeline over the captured transcript. */
export async function finalize(session: CaptureSession): Promise<Record<string, unknown>> {
  const transcriptText = session.transcriptText();
  const processingResult = await processTranscription(
    transcriptText,
    session.templateFields,
    session.patientContext,
    session.isAmbient,
    session.primaryCondition,
    { seedCache: true },
  );
  return {
    fields: processingResult.fields,
    rawTranscription: transcriptText,
    transcriptionDuration: Number(session.sttSeconds.toFixed(2)),
    processDuration: processingResult.process_duration,
  };
}
