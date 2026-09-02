// Whisper manager for local transcription (letter dictation + ambient scribe).
// Invocation verified against the Xenova/realtime-whisper-webgpu reference worker.

import { getAsrModelId } from "./db";
import { enqueueModelJob } from "./llm";

export const ASR_PRESETS = [
  { id: "onnx-community/whisper-base.en", label: "whisper-base.en (default)" },
  { id: "onnx-community/whisper-tiny.en", label: "whisper-tiny.en (fast)" },
];

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
