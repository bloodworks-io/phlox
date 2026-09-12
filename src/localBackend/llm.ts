// transformers.js manager for local Qwen3.5 letter/summary generation.
// Invocation mirrors the official webml-community/Qwen3.5-WebGPU demo,
// verified against @huggingface/transformers 4.2.0.

import { getModelId } from "./db";

export interface LlmStatus {
  state: "idle" | "loading" | "ready" | "error";
  modelId?: string;
  device?: string;
  progress?: number;
  error?: string;
}

export interface ChatContentPart {
  type: "image" | "text";
  text?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
}

export interface ChatOptions {
  temperature: number;
  max_new_tokens?: number;
  /** Data-URL images paired with {type:"image"} parts in the messages. */
  images?: string[];
}

export const LLM_PRESETS = [
  { id: "onnx-community/Qwen3.5-0.8B-ONNX-OPT", label: "0.8B · fast" },
  { id: "onnx-community/Qwen3.5-2B-ONNX-OPT", label: "2B · balanced" },
  { id: "onnx-community/Qwen3.5-4B-ONNX-OPT", label: "4B · best" },
];

export const CUSTOM_LLM_PRESET = "__custom__";

interface LoadedModel {
  // transformers.js types are unwieldy across lazy dynamic imports; the demo
  // only touches this narrow surface.
  processor: {
    tokenizer: {
      apply_chat_template: (messages: ChatMessage[], options: Record<string, unknown>) => string;
      decode: (ids: unknown, options: Record<string, unknown>) => string;
    };
  } & CallableFunction;
  model: {
    generate: (inputs: Record<string, unknown>) => Promise<{
      sequences: { dims: number[]; [index: number]: { slice: (spec: unknown[]) => unknown } };
    }>;
  };
  RawImage: { fromDataURL: (url: string) => Promise<unknown> };
  device: string;
}

let status: LlmStatus = { state: "idle" };
const listeners = new Set<(status: LlmStatus) => void>();

export function onStatus(cb: (status: LlmStatus) => void): () => void {
  listeners.add(cb);
  cb(status);
  return () => listeners.delete(cb);
}

function emit(next: LlmStatus): void {
  status = next;
  for (const listener of listeners) listener(next);
}

// --- model cache ---

let cached: LoadedModel | null = null;
let cachedModelId: string | null = null;
let loadPromise: Promise<LoadedModel> | null = null;

export function isModelReady(): boolean {
  return cached !== null && cachedModelId === getModelId();
}

/** Drop the loaded model (call after switching the model id in settings). */
export function invalidateModel(): void {
  if (cachedModelId !== getModelId()) {
    cached = null;
    cachedModelId = null;
    emit({ state: "idle" });
  }
}

export async function ensureModel(): Promise<LoadedModel> {
  const modelId = getModelId();
  if (cached && cachedModelId === modelId) return cached;
  if (loadPromise) return loadPromise;

  cached = null;
function dtypeFor(device: "webgpu" | "wasm") {
  return device === "webgpu"
    ? ({ embed_tokens: "q4", vision_encoder: "fp16", decoder_model_merged: "q4" } as const)
    : ({ embed_tokens: "q8", vision_encoder: "q8", decoder_model_merged: "q8" } as const);
}

/**
 * "gpu" is not in the installed TS DOM lib. Probe the adapter instead of
 * trusting navigator.gpu presence: iGPUs with broken WebGPU stacks (e.g.
 * Twin Lake N350 + Mesa) pass the sniff test, then die on session creation
 * because the q4 files need the WebGPU-only GatherBlockQuantized kernel and
 * shader-f16.
 */
async function hasUsableWebGpu(): Promise<"webgpu" | "wasm"> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return "wasm";
  try {
    const adapter = (await gpu.requestAdapter()) as { features?: Set<string> } | null;
    return adapter && adapter.features?.has("shader-f16") ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}

  cachedModelId = null;

  const initialDevice = await hasUsableWebGpu();
  emit({ state: "loading", modelId, device: initialDevice });

  // Aggregate per-file download progress into one 0-100 number.
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
      emit({ state: "loading", modelId, device: initialDevice, progress: Math.min(100, Math.round((loaded / total) * 100)) });
    }
  };

  loadPromise = (async () => {
    // Dynamic import keeps transformers.js (+onnxruntime-web) out of the main
    // bundle: only demo runs that touch the model download the multi-MB chunk.
    const tf = await import("@huggingface/transformers");
    tf.env.allowLocalModels = false;
    // Serve ort wasm from the bundled copy (vite staticCopy → <base>ort/)
    // instead of onnxruntime-web's jsdelivr CDN default.
    tf.env.backends.onnx.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
    const processor = await tf.AutoProcessor.from_pretrained(modelId, { progress_callback });
    // ponytail: single webgpu→wasm retry; the probe covers most broken-WebGPU
    // machines, this catches driver-level session failures the probe misses.
    let device = initialDevice;
    let model;
    try {
      model = await tf.Qwen3_5ForConditionalGeneration.from_pretrained(modelId, {
        device,
        dtype: dtypeFor(device),
        progress_callback,
      });
    } catch (error) {
      if (device === "wasm") throw error;
      console.warn(`[llm] webgpu load failed (${String(error).slice(0, 200)}) — retrying on wasm (q8)`);
      device = "wasm";
      model = await tf.Qwen3_5ForConditionalGeneration.from_pretrained(modelId, {
        device,
        dtype: dtypeFor(device),
        progress_callback,
      });
    }
    // The loaded pair is structurally the LoadedModel surface; TS loses it across
    // the lazy module boundary.
    const loaded = { processor, model, device, RawImage: tf.RawImage } as unknown as LoadedModel;
    return loaded;
  })();

  try {
    cached = await loadPromise;
    cachedModelId = modelId;
    emit({ state: "ready", modelId, device });
    return cached;
  } catch (error) {
    emit({ state: "error", modelId, device, error: String(error) });
    throw error;
  } finally {
    loadPromise = null;
  }
}

// --- call serialization (model.generate is not concurrency-safe) ---

let queueTail: Promise<unknown> = Promise.resolve();

export function enqueueModelJob<T>(job: () => Promise<T>): Promise<T> {
  const run = queueTail.then(job, job);
  queueTail = run.catch(() => {});
  return run;
}

export async function chat(messages: ChatMessage[], options: ChatOptions): Promise<string> {
  const { temperature, max_new_tokens = 768, images } = options;
  return enqueueModelJob(async () => {
    const started = performance.now();
    const { processor, model, RawImage } = await ensureModel();
    console.info(
      `[llm] chat start: ${messages.length} messages (${messages.map((m) => `${m.role}:${typeof m.content === "string" ? m.content.length : `${m.content.length} parts`}ch`).join(" ")}${images ? ` +${images.length} image(s)` : ""}) temp=${temperature} max_new=${max_new_tokens}`,
    );
    const prompt = processor.tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      enable_thinking: false,
      tokenize: false, // v4 defaults tokenize:true → returns an ids object, not the prompt string
    }) as string;
    // Processor output is the generate() input dict plus tokenized prompt ids;
    // with images it also embeds the vision encoder's pixel values.
    const prepared = images?.length
      ? await Promise.all(images.map((url) => RawImage.fromDataURL(url)))
      : undefined;
    const inputs = ((prepared ? await processor(prompt, prepared) : await processor(prompt))) as unknown as {
      input_ids: { dims: number[] };
    } & Record<string, unknown>;
    const inputLen = inputs.input_ids.dims.at(-1) ?? 0;
    if (inputLen === 0) {
      console.error(`[llm] empty prompt after tokenization; template output: ${JSON.stringify(String(prompt).slice(0, 200))}`);
    }
    const result = await model.generate({ ...inputs, max_new_tokens, do_sample: true, temperature, return_dict_in_generate: true });
    // Decode only the newly generated tokens (everything after the prompt).
    const totalLen = result.sequences.dims.at(-1) ?? 0;
    const newTokenCount = Math.max(0, totalLen - inputLen);
    const newTokens = result.sequences[0].slice([inputLen, null]);
    const withSpecials = processor.tokenizer.decode(newTokens, { skip_special_tokens: false });
    const text = processor.tokenizer.decode(newTokens, { skip_special_tokens: true });
    const finalText = text.split("</think>").pop().trim();
    const elapsed = ((performance.now() - started) / 1000).toFixed(1);
    console.info(
      `[llm] generate done in ${elapsed}s: prompt=${inputLen}t new=${newTokenCount}t final=${finalText.length}ch; raw(new tokens, specials kept)=${JSON.stringify(withSpecials.slice(0, 300))}`,
    );
    if (!finalText) {
      console.warn(
        `[llm] EMPTY OUTPUT: new=${newTokenCount}t. All-special output means the model emitted only stop/think tokens (e.g. immediate EOS at temp=${temperature}); specials kept: ${JSON.stringify(withSpecials.slice(0, 500))}`,
      );
    }
    return finalText;
  });
}
