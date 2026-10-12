// Whisper manager for local transcription (letter dictation + ambient scribe).
// Invocation verified against the Xenova/realtime-whisper-webgpu reference worker.

import { getAsrModelId } from "./db";
import { enqueueModelJob } from "./llm";

export const ASR_PRESETS = [
  { id: "omimed", label: "omimed · medical STT (WebGPU)" },
  { id: "onnx-community/whisper-base.en", label: "whisper-base.en (default)" },
  { id: "onnx-community/whisper-tiny.en", label: "whisper-tiny.en (fast)" },
];

/**
 * Omi Med STT v1 — a fine-tune of parakeet-tdt-0.6b-v2 with per-layer
 * adapters, converted into the parakeet.wgsl package format by the vendored
 * fork (vendor/parakeet.wgsl). Served from the local mirror under
 * public/models/parakeet-omimed when present, else the HF mirror
 * bloodworks-io/parakeet-omimed-v1. fp16 only — fp32-class adapters fail
 * loudly at the encoder config gate instead of loading the wrong package.
 */
export const OMIMED_ID = "omimed";
const OMIMED_FP16_MANIFEST_SHA256 =
  "cf535dd1050c9ce42b7785f05c1d0c164d64defc0220d74df4e91d159fc4fe39";

function isParakeetEngine(id: string): boolean {
  return id === OMIMED_ID;
}

type AsrPipeline = ((
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string }>) & {
  device?: string;
};

export type AsrDevice = "webgpu" | "wasm";

interface TranscribeResult {
  text: string;
  duration: number;
}

/** Both the GPU and CPU runs failed — the router maps this to an honest detail. */
export class AsrError extends Error {
  constructor() {
    super("Local transcription failed");
  }
}

/** ORT WebGPU kernel failures (int32 overflow, OOM) — retryable on CPU. */
function isGpuKernelError(error: unknown): boolean {
  return /Integer overflow|Out of memory|OrtRun/i.test(String(error));
}

function preferredDevice(): AsrDevice {
  // "gpu" is not in the installed TS DOM lib; WebGPU presence selects the device.
  const navigatorWithGpu = navigator as unknown as { gpu?: unknown };
  return navigatorWithGpu.gpu ? "webgpu" : "wasm";
}

// One pipeline per model+device (webgpu attempt + wasm fallback coexist).
const pipelines = new Map<string, AsrPipeline>();
const loadPromises = new Map<string, Promise<AsrPipeline>>();

// Toast-level progress for first download (the status pill tracks the LLM only).
let lastReportedPercent = -1;
export type AsrProgressListener = (info: { percent: number; modelId: string }) => void;
let progressListener: AsrProgressListener | null = null;

export function onAsrProgress(listener: AsrProgressListener): void {
  progressListener = listener;
}

export function invalidateAsr(): void {
  const prefix = `${getAsrModelId()}::`;
  for (const key of pipelines.keys()) {
    if (!key.startsWith(prefix)) pipelines.delete(key);
  }
  if (!isParakeetEngine(getAsrModelId())) disposeParakeet();
}

// --- parakeet.wgsl engine (WebGPU-only; whisper remains the fallback path) ---

interface ParakeetController {
  readonly initialized: boolean;
  transcribe(audio: Blob, options?: Record<string, unknown>): Promise<{
    text: string;
    metrics: { speedFactor?: number; encoderMs?: number; decoderMs?: number; totalMs?: number };
  }>;
  dispose(): void;
}

let parakeetTranscriber: ParakeetController | null = null;
let parakeetModelId: string | null = null;

interface ParakeetModelSources {
  fp16: string;
  fp32: string;
  local: boolean;
}

async function resolveParakeetModelUrls(tfBase: string): Promise<ParakeetModelSources> {
  // Model URLs must be absolute: the parakeet engine resolves them inside
  // its module worker, where relative paths would resolve against the
  // worker script location under node_modules. A local mirror under
  // public/models/parakeet-omimed wins when present; otherwise the
  // byte-exact HF mirror (bloodworks-io/parakeet-omimed-v1, CC-BY-4.0
  // attribution chain in its README). fp16 only — fp32-class adapters fail
  // loudly at the encoder config gate instead of loading the wrong package.
  const localManifest = new URL(
    `${tfBase}models/parakeet-omimed/fp16/${OMIMED_FP16_MANIFEST_SHA256}/manifest.json`,
    window.location.origin,
  ).href;
  try {
    const probe = await fetch(localManifest, { method: "HEAD" });
    if (probe.ok) return { fp16: localManifest, fp32: localManifest, local: true };
  } catch {
    // fall through to the HF mirror
  }
  const remoteManifest = `https://huggingface.co/bloodworks-io/parakeet-omimed-v1/resolve/main/fp16/${OMIMED_FP16_MANIFEST_SHA256}/manifest.json`;
  return { fp16: remoteManifest, fp32: remoteManifest, local: false };
}

function disposeParakeet(): void {
  parakeetTranscriber?.dispose();
  parakeetTranscriber = null;
  parakeetModelId = null;
}

async function ensureParakeet(): Promise<ParakeetController | null> {
  const modelId = getAsrModelId();
  if (!isParakeetEngine(modelId)) return null;
  if (parakeetTranscriber && parakeetModelId === modelId) return parakeetTranscriber;
  disposeParakeet();
  const pk = await import("parakeet.wgsl");
  const support = await pk.checkSupport();
  if (!support.supported) {
    console.warn("[asr] parakeet unsupported (missing WebGPU?):", support.errors);
    return null;
  }
  console.info(`[asr] parakeet profile: ${support.executionProfile?.precision}/${support.executionProfile?.kernelBackend} on ${support.adapter?.description ?? "gpu"}`);
  const base = (import.meta.env.BASE_URL ?? "/") as string;
  const modelUrls = await resolveParakeetModelUrls(base);
  console.info(`[asr] parakeet models: ${modelUrls.local ? "local mirror" : "HF mirror"}`);
  parakeetTranscriber = pk.createTranscriber({
    modelUrls: { fp16: modelUrls.fp16, fp32: modelUrls.fp32 },
    onLoadProgress: (p: { phase: string; fraction: number }) => {
      if (p.phase === "weights") {
        progressListener?.({ percent: Math.min(100, Math.round(p.fraction * 100)), modelId: OMIMED_ID });
      }
    },
  }) as unknown as ParakeetController;
  parakeetModelId = modelId;
  return parakeetTranscriber;
}

export function blobSourceName(blob: Blob): string {
  const mime = blob.type ?? "";
  if (mime.includes("webm")) return "audio.webm";
  if (mime.includes("ogg")) return "audio.ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "audio.m4a";
  if (mime.includes("mpeg")) return "audio.mp3";
  if (mime.includes("wav")) return "audio.wav";
  if (mime.includes("flac")) return "audio.flac";
  return "audio.webm";
}

/** Load/warm whichever ASR engine the current preset selects (onboarding button). */
export async function warmAsr(): Promise<void> {
  if (isParakeetEngine(getAsrModelId())) {
    const parakeet = await ensureParakeet();
    if (parakeet) return;
    // WebGPU-less browser: pre-load the whisper fallback instead.
  }
  await ensureAsr();
}

export async function ensureAsr(device: AsrDevice = preferredDevice()): Promise<AsrPipeline> {
  const modelId = getAsrModelId();
  const key = `${modelId}::${device}`;
  const cached = pipelines.get(key);
  if (cached) return cached;
  const pending = loadPromises.get(key);
  if (pending) return pending;

  const dtype =
    device === "webgpu"
      ? ({ encoder_model: "fp32", decoder_model_merged: "q4" } as const)
      : ({ encoder_model: "q8", decoder_model_merged: "q8" } as const);

  const fileProgress = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (data: { status?: string; file?: string; loaded?: number; total?: number }) => {
    if (data.status !== "progress" || !data.file || !data.total) return;
    fileProgress.set(data.file, { loaded: data.loaded ?? 0, total: data.total });
    let loaded = 0;
    let total = 0;
    for (const file of fileProgress.values()) {
      loaded += file.loaded;
      total += file.total;
    }
    if (total > 0) {
      const percent = Math.min(100, Math.round((loaded / total) * 100));
      if (percent !== lastReportedPercent) {
        lastReportedPercent = percent;
        progressListener?.({ percent, modelId });
      }
    }
  };

  const load = (async () => {
    // Dynamic import keeps transformers.js out of the main bundle (see llm.ts).
    const tf = await import("@huggingface/transformers");
    tf.env.allowLocalModels = false;
    // Same bundled-wasm policy as llm.ts: <base>ort/ from vite staticCopy.
    tf.env.backends.onnx.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
    const asr = await tf.pipeline("automatic-speech-recognition", modelId, {
      device,
      dtype,
      progress_callback,
    });
    return asr as unknown as AsrPipeline;
  })();

  loadPromises.set(key, load);
  try {
    const pipeline = await load;
    pipelines.set(key, pipeline);
    return pipeline;
  } finally {
    loadPromises.delete(key);
  }
}

/** Transcribe an audio blob; duration is wall-clock seconds of processing. */
export async function transcribe(blob: Blob): Promise<TranscribeResult> {
  const started = performance.now();
  return enqueueModelJob(async () => {
    if (isParakeetEngine(getAsrModelId())) {
      const parakeet = await ensureParakeet();
      if (parakeet) {
        const result = await parakeet.transcribe(blob, { sourceName: blobSourceName(blob) });
        const m = result.metrics ?? {};
        console.info(
          `[asr] parakeet done: ${(m.totalMs ?? 0) / 1000}s total, speedFactor=${m.speedFactor ?? "?"}, encoder=${m.encoderMs ?? "?"}ms decoder=${m.decoderMs ?? "?"}ms`,
        );
        return {
          text: String(result.text ?? "").trim(),
          duration: Number(((performance.now() - started) / 1000).toFixed(2)),
        };
      }
      console.warn("[asr] parakeet unavailable — falling back to whisper path");
    }
    const url = URL.createObjectURL(blob);
    let audio: Float32Array;
    try {
      // Dynamic import pairs with llm.ts's — transformers.js stays chunked.
      const tf = await import("@huggingface/transformers");
      audio = await tf.read_audio(url, 16000);
    } finally {
      URL.revokeObjectURL(url);
    }
    const device = preferredDevice();
    console.info(`[asr] transcribe start: ${(audio.length / 16000).toFixed(1)}s of audio on ${device}`);
    const run = async (asr: AsrPipeline): Promise<TranscribeResult> => {
      const result = await asr(audio, { chunk_length_s: 30, stride_length_s: 5 });
      return {
        text: String(result.text ?? "").trim(),
        duration: Number(((performance.now() - started) / 1000).toFixed(2)),
      };
    };
    try {
      return await run(await ensureAsr(device));
    } catch (error) {
      // transformers.js v4's native WebGPU runtime still hits ORT int32
      // kernel bugs on some GPU/driver combos (SafeIntOnOverflow on the very
      // first 30s chunk) — rerun once on the wasm CPU pipeline: slower, but
      // deterministic.
      if (device !== "webgpu" || !isGpuKernelError(error)) throw error;
      console.warn("[asr] webgpu run failed, retrying on wasm:", error);
      try {
        return await run(await ensureAsr("wasm"));
      } catch (fallbackError) {
        if (isGpuKernelError(fallbackError)) throw new AsrError();
        throw fallbackError;
      }
    }
  });
}
