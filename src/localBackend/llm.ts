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
  /** JSON schema source text; constrains generation via XGrammar when available. */
  jsonSchema?: string;
  /** Seed generation with the warm KV prefix (capture prefill reuse). */
  seedCache?: boolean;
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
      get_vocab: () => Map<string, number> | Record<string, number>;
    };
  } & CallableFunction;
  model: {
    config?: { vocab_size?: number; text_config?: { vocab_size?: number } };
    generate: (inputs: Record<string, unknown>) => Promise<{
      sequences: { dims: number[]; [index: number]: { slice: (spec: unknown[]) => unknown } };
    }>;
  } & CallableFunction; // callable: raw forward pass returns session outputs incl. present.* KV state
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
    grammarRuntime = null;
    grammarModelId = null;
    warmDisabled = false;
    void clearWarmCache();
    emit({ state: "idle" });
  }
}

/** Device of the loaded model ("webgpu" | "wasm"), or null when not loaded. */
export function currentModelDevice(): string | null {
  return cached && cachedModelId === getModelId() ? cached.device : null;
}

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

export interface GpuDescription {
  tier: "webgpu" | "wasm";
  shaderF16: boolean;
  /** Adapter vendor/architecture where the browser exposes it (e.g. "apple m3"). */
  label: string | null;
}

/** UI-facing variant of hasUsableWebGpu: tier + shader-f16 flag + adapter label. */
export async function describeGpu(): Promise<GpuDescription> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return { tier: "wasm", shaderF16: false, label: null };
  try {
    const adapter = (await gpu.requestAdapter()) as {
      features?: Set<string>;
      info?: { vendor?: string; architecture?: string; description?: string };
    } | null;
    if (!adapter) return { tier: "wasm", shaderF16: false, label: null };
    const shaderF16 = adapter.features?.has("shader-f16") ?? false;
    const info = adapter.info ?? {};
    const label =
      [info.description, info.architecture, info.vendor].find((part) => part && part.trim()) ?? null;
    return { tier: shaderF16 ? "webgpu" : "wasm", shaderF16, label };
  } catch {
    return { tier: "wasm", shaderF16: false, label: null };
  }
}

export async function ensureModel(): Promise<LoadedModel> {
  const modelId = getModelId();
  if (cached && cachedModelId === modelId) return cached;
  if (loadPromise) return loadPromise;

  cached = null;
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
    emit({ state: "ready", modelId, device: cached.device });
    return cached;
  } catch (error) {
    emit({ state: "error", modelId, device: cached?.device ?? initialDevice, error: String(error) });
    throw error;
  } finally {
    loadPromise = null;
  }
}

// --- call serialization (model.generate is not concurrency-safe) ---

let queueTail: Promise<unknown> = Promise.resolve();
let queueDepth = 0;

export function enqueueModelJob<T>(job: () => Promise<T>): Promise<T> {
  queueDepth += 1;
  const run = queueTail.then(job, job);
  queueTail = run.finally(() => {
    queueDepth -= 1;
  });
  return run;
}

/** Jobs currently waiting/running on the model queue (warming cadence gate). */
export function modelQueueDepth(): number {
  return queueDepth;
}

// --- warm KV prefill (browser equivalent of llama.cpp cache_prompt) ---
// A single-slot prefix cache: prefillMessages() runs a raw forward pass over
// the prompt and keeps the resulting DynamicCache + token ids; a later chat()
// with seedCache:true passes the cache into generate(), which slices the
// input to the unprocessed suffix internally (verified in transformers.js
// 4.2.0: generate accepts past_key_values, prepare_inputs_for_generation
// handles mrope positions for seeded continuations).

interface WarmCache {
  modelId: string;
  /** Prompt token ids the cache holds (strict prefix of the next prompt). */
  tokens: number[];
  cache: unknown;
}

let warmCache: WarmCache | null = null;
let warmDisabled = false;

export async function clearWarmCache(): Promise<void> {
  const previous = warmCache;
  warmCache = null;
  await disposeCache(previous?.cache);
}

async function disposeCache(cache: unknown): Promise<void> {
  try {
    await (cache as { dispose?: () => Promise<void> } | null)?.dispose?.();
  } catch {
    // Already freed — nothing to do.
  }
}

/** Longest common prefix length between stored warm tokens and current ids. */
function warmPrefixLength(stored: number[], current: ArrayLike<number> | ArrayLike<bigint>): number {
  const limit = Math.min(stored.length, current.length);
  let length = 0;
  while (length < limit && stored[length] === Number(current[length])) length += 1;
  return length;
}

/** Rename raw forward present.* outputs into past_key_values cache entries. */
function cacheFromOutputs(outputs: Record<string, unknown>): Record<string, unknown> | null {
  const entries: Record<string, unknown> = Object.create(null);
  for (const name of Object.keys(outputs)) {
    if (!name.startsWith("present")) continue;
    const newName = name
      .replace("present_ssm", "past_ssm")
      .replace("present_conv", "past_conv")
      .replace("present_recurrent", "past_recurrent") // Qwen3.5 hybrid layers
      .replace("present", "past_key_values");
    entries[newName] = outputs[name];
  }
  return Object.keys(entries).length > 0 ? entries : null;
}

interface TensorLike {
  data: ArrayLike<bigint> | ArrayLike<number>;
  dims: number[];
  slice: (...spec: unknown[]) => TensorLike;
}

function tensorIds(tensor: TensorLike): number[] {
  const ids: number[] = [];
  for (let i = 0; i < tensor.data.length; i++) ids.push(Number(tensor.data[i]));
  return ids;
}

/**
 * Prefill a prompt into the warm KV cache (output discarded, one forward
 * pass). Mirrors server warm_prompt.prefill: the transcript grows
 * append-only, so a previously warmed cache is extended rather than rebuilt.
 */
export async function prefillMessages(messages: ChatMessage[]): Promise<void> {
  if (warmDisabled) return;
  return enqueueModelJob(async () => {
    const tf = await import("@huggingface/transformers");
    const { processor, model } = await ensureModel();
    // No generation prompt: the warm prompt must be a strict token prefix of
    // the final chat() prompt (which renders the same messages plus the
    // assistant opener) — the transcript only ever appends inside the user
    // turn, before the terminator the warm prompt ends on.
    const prompt = processor.tokenizer.apply_chat_template(messages, {
      add_generation_prompt: false,
      enable_thinking: false,
      tokenize: false,
    }) as string;
    const inputs = (await processor(prompt)) as unknown as Record<string, TensorLike> & {
      input_ids: TensorLike;
      attention_mask?: TensorLike;
    };
    const total = inputs.input_ids.dims.at(-1) ?? 0;
    if (total === 0) throw new Error("warm prefill: empty prompt after tokenization");

    const previous = warmCache;
    warmCache = null;
    let feeds: Record<string, unknown> = { ...inputs };
    let pastLength = 0;
    if (previous && previous.modelId === getModelId() && previous.tokens.length < total) {
      const prefix = warmPrefixLength(previous.tokens, inputs.input_ids.data);
      if (prefix === previous.tokens.length && prefix > 0) {
        // Strict extension: seed and prefill only the suffix.
        pastLength = prefix;
        feeds = {
          input_ids: inputs.input_ids.slice(null, [pastLength, null]),
          attention_mask:
            inputs.attention_mask ??
            new tf.Tensor("int64", BigInt64Array.from({ length: total }, () => 1n), [1, total]),
          position_ids: new tf.Tensor(
            "int64",
            BigInt64Array.from({ length: total - pastLength }, (_, i) => BigInt(pastLength + i)),
            [1, total - pastLength],
          ),
          past_key_values: previous.cache,
          use_cache_branch: new tf.Tensor("bool", [true], [1]),
        };
      }
    }

    const outputs = (await (model as unknown as (input: Record<string, unknown>) => Promise<Record<string, unknown>>)(feeds)) as Record<string, unknown>;
    const entries = cacheFromOutputs(outputs);
    if (entries === null) {
      warmDisabled = true;
      await disposeCache(previous?.cache);
      throw new Error("warm prefill: model produced no present.* KV outputs");
    }
    await disposeCache(previous?.cache);
    const cache = new tf.DynamicCache(entries as unknown as Record<string, never>);
    warmCache = { modelId: getModelId(), tokens: tensorIds(inputs.input_ids), cache };
    console.info(`[llm] warm prefill: ${total}t (${total - pastLength}t new, ${pastLength}t cached)`);
  });
}

// --- grammar-constrained decoding (XGrammar) ---

interface GrammarMatcher {
  acceptToken(tokenId: number): boolean;
  getNextTokenBitmask(): Promise<Int32Array>;
  isTerminated(): boolean;
  dispose(): void;
}

interface GrammarRuntime {
  compileJSONSchema(schema: string): Promise<unknown>;
  createMatcher(compiled: unknown): Promise<GrammarMatcher>;
}

let grammarRuntime: GrammarRuntime | null = null;
let grammarModelId: string | null = null;

async function ensureGrammar(): Promise<GrammarRuntime | null> {
  const modelId = getModelId();
  if (grammarRuntime && grammarModelId === modelId) return grammarRuntime;
  try {
    const { processor, model } = await ensureModel();
    const xg = await import("@mlc-ai/web-xgrammar");
    // get_vocab() returns a Map (tokenizers-wasm); VL configs nest vocab_size
    // under text_config. A vocab of ~1 silently produces an all-rejecting
    // matcher, so guard before trusting it.
    const vocabMap = processor.tokenizer.get_vocab() as Map<string, number> | Record<string, number>;
    const vocab = vocabMap instanceof Map ? Object.fromEntries(vocabMap) : vocabMap;
    let maxId = 0;
    for (const id of Object.values(vocab)) maxId = Math.max(maxId, id);
    const encodedVocab = new Array<string>(maxId + 1).fill("");
    for (const [token, id] of Object.entries(vocab)) encodedVocab[id] = token;
    const vocabSize =
      model.config?.vocab_size ?? model.config?.text_config?.vocab_size ?? encodedVocab.length;
    const tokenizerInfo = await xg.TokenizerInfo.createTokenizerInfo(encodedVocab, "byte_level", false, vocabSize);
    if (tokenizerInfo.getVocabSize() < 1000) {
      throw new Error(`tokenizer vocab parsed as ${tokenizerInfo.getVocabSize()} entries — refusing to constrain`);
    }
    console.info(`[llm] xgrammar ready (vocab ${tokenizerInfo.getVocabSize()})`);
    const compiler = await xg.GrammarCompiler.createGrammarCompiler(tokenizerInfo);
    grammarRuntime = {
      // unenforced indentation (shorter output than pretty-printed JSON)
      compileJSONSchema: (schema) => compiler.compileJSONSchema(schema, true, -1),
      createMatcher: (compiled) => xg.GrammarMatcher.createGrammarMatcher(compiled as never),
    };
    grammarModelId = modelId;
    return grammarRuntime;
  } catch (error) {
    console.warn(`[llm] xgrammar unavailable — falling back to unconstrained generation: ${error}`);
    grammarRuntime = null;
    grammarModelId = null;
    return null;
  }
}

async function setupMatcher(schema: string): Promise<GrammarMatcher | null> {
  const runtime = await ensureGrammar();
  if (!runtime) return null;
  try {
    return await runtime.createMatcher(await runtime.compileJSONSchema(schema));
  } catch (error) {
    console.warn(`[llm] schema compile failed — generating unconstrained: ${error}`);
    return null;
  }
}

/**
 * Per-token -Infinity masking of grammar-disallowed logits. The next-step bitmask
 * is prefetched: the binding is synchronous under its async wrapper, so the
 * promise resolves in a microtask — long before generate's next forward pass.
 * ponytail: bitmask polarity is empirical — set-bit = allowed in
 * @mlc-ai/web-xgrammar 0.1.27 (contradicts its own .d.ts; see step-0 diag).
 */
async function grammarHooks(matcher: GrammarMatcher): Promise<Record<string, unknown>> {
  const tf = await import("@huggingface/transformers");
  // Freshness contract: the stopper (called right after each token is sampled)
  // accepts it into the FSM and refills `mask` via microtask; generate()'s
  // `await forward(...)` before the next processor call guarantees the refill
  // has landed — so the mask applied at step k always reflects the state after
  // token k-1. Keeping the accept+prefetch inside the processor instead leaves
  // the mask one step stale (the processor list is fully synchronous).
  let mask = await matcher.getNextTokenBitmask(); // root state
  let step = 0;
  const masker = new (class extends tf.LogitsProcessor {
    _call(inputIds: bigint[][], scores: { data: { length: number; [index: number]: number | bigint } }) {
      void inputIds;
      const { data } = scores;
      // Empirical polarity of @mlc-ai/web-xgrammar 0.1.27: bit SET = allowed
      // (the .d.ts claims the inverse; field diag proved otherwise). Mask the rest.
      for (let w = 0; w < mask.length; w++) {
        const bits = mask[w];
        if (bits === -1) continue; // all 32 allowed
        for (let b = 0; b < 32; b++) {
          if ((bits & (1 << b)) !== 0) continue;
          const id = w * 32 + b;
          if (id < data.length) data[id] = -Infinity;
        }
      }
      step += 1;
      return scores;
    }
  })();
  const processors = new tf.LogitsProcessorList();
  processors.push(masker);
  const stopper = new (class extends tf.StoppingCriteria {
    _call(inputIds: number[][]) {
      const lastId = Number(inputIds[0].at(-1));
      if (!matcher.acceptToken(lastId)) {
        console.warn(`[llm] grammar rejected sampled token ${lastId} (step ${step})`);
      }
      // Never prefetch past termination: the C++ CHECK in getNextTokenBitmask
      // aborts the wasm Module once the stop token has been accepted.
      if (!matcher.isTerminated()) {
        // .catch: this microtask can outlive the final generate() call and land
        // after chat()'s finally disposes the matcher.
        void matcher
          .getNextTokenBitmask()
          .then((next) => {
            mask = next;
          })
          .catch(() => {});
      }
      return [matcher.isTerminated()];
    }
  })();
  const criteria = new tf.StoppingCriteriaList();
  criteria.push(stopper);
  return { logits_processor: processors, stopping_criteria: criteria };
}

export async function chat(messages: ChatMessage[], options: ChatOptions): Promise<string> {
  const { temperature, max_new_tokens = 768, images, jsonSchema, seedCache } = options;
  return enqueueModelJob(async () => {
    const started = performance.now();
    const { processor, model, RawImage } = await ensureModel();
    const grammar = jsonSchema ? await setupMatcher(jsonSchema) : null;
    if (jsonSchema) console.info(grammar ? "[llm] grammar constraint active" : "[llm] grammar unavailable, unconstrained");
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
      input_ids: { dims: number[]; data: ArrayLike<bigint> };
    } & Record<string, unknown>;
    const inputLen = inputs.input_ids.dims.at(-1) ?? 0;
    if (inputLen === 0) {
      console.error(`[llm] empty prompt after tokenization; template output: ${JSON.stringify(String(prompt).slice(0, 200))}`);
    }
    // Warm-prefix seeding: the capture prefill holds a strict prefix of this
    // prompt — hand generate() the cache and it slices/positions the suffix.
    let seeded: unknown = null;
    if (seedCache && !warmDisabled && !images && warmCache && warmCache.modelId === getModelId()) {
      const prefix = warmPrefixLength(warmCache.tokens, inputs.input_ids.data);
      if (prefix === warmCache.tokens.length && prefix > 0 && prefix < inputLen) {
        seeded = warmCache.cache;
        console.info(`[llm] seeding from warm cache: ${prefix}/${inputLen}t prefilled`);
      } else if (prefix > 0) {
        console.info(`[llm] warm cache unusable (prefix ${prefix}/${warmCache.tokens.length}t of ${inputLen}t); full prefill`);
      }
    }
    let result: Awaited<ReturnType<LoadedModel["model"]["generate"]>>;
    try {
      result = await model.generate({
        ...inputs,
        max_new_tokens,
        do_sample: true,
        temperature,
        return_dict_in_generate: true,
        ...(seeded ? { past_key_values: seeded } : null),
        ...(grammar ? await grammarHooks(grammar) : null),
      });
    } catch (error) {
      if (seeded) {
        // Seeded generation broke (model/template mismatch with the cache):
        // disable warming so the scribe retry prefills from scratch.
        warmDisabled = true;
        void clearWarmCache();
      }
      throw error;
    } finally {
      grammar?.dispose();
      if (seeded) {
        // generate() mutates the seeded cache in place; the store no longer
        // holds a pure prompt prefix, so drop it.
        void clearWarmCache();
      }
    }
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
