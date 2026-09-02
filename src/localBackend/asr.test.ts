// asr.ts device-fallback wiring: a GPU-kernel failure (ORT SafeInt overflow)
// on the webgpu pipeline must retry once on the wasm CPU pipeline instead of
// failing the request. transformers.js is mocked — only the wiring is under
// test, the model itself needs a real browser/GPU.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pipelineMock, readAudioMock } = vi.hoisted(() => ({
  pipelineMock: vi.fn(),
  readAudioMock: vi.fn(),
}));

vi.mock("@huggingface/transformers", () => ({
  env: { allowLocalModels: false, backends: { onnx: { wasm: {} } } },
  read_audio: (...args: unknown[]) => readAudioMock(...(args as [string, number])),
  pipeline: (...args: unknown[]) => pipelineMock(...args),
}));

vi.mock("./llm", () => ({
  // Serialize-through is irrelevant here; run jobs immediately.
  enqueueModelJob: <T>(job: () => Promise<T>): Promise<T> => job(),
}));

// vitest's jsdom environment exposes a method-less localStorage stub; db.ts
// reads the ASR model id from it on every ensureAsr call.
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
// jsdom has no URL.createObjectURL.
Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: vi.fn(() => "blob:mock"),
});
Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });

// Exact failure from the field report (2026-09): SafeInt overflow on the
// first whisper chunk via transformers.js v4's native WebGPU runtime.
const ORT_OVERFLOW =
  "failed to call OrtRun(). ERROR_CODE: 1, ERROR_MESSAGE: /mnt/vss/_work/1/s/onnxruntime/core/common/safeint.h:17 static void SafeIntExceptionHandler<onnxruntime::OnnxRuntimeException>::SafeIntOnOverflow() Integer overflow";

function setWebgpu(enabled: boolean): void {
  Object.defineProperty(navigator, "gpu", { value: enabled ? {} : undefined, configurable: true });
}

interface PipelineOptions {
  device: string;
  dtype: Record<string, string>;
}

let asr: typeof import("./asr");
let webgpuRun: ReturnType<typeof vi.fn>;
let wasmRun: ReturnType<typeof vi.fn>;

describe("asr webgpu → wasm fallback", () => {
  beforeEach(async () => {
    vi.resetModules(); // asr caches pipelines at module scope
    vi.clearAllMocks();
    readAudioMock.mockResolvedValue(new Float32Array(16000 * 30)); // 30 s of audio
    webgpuRun = vi.fn();
    wasmRun = vi.fn();
    pipelineMock.mockImplementation(
      async (_task: string, _modelId: string, options: PipelineOptions) =>
        options.device === "webgpu" ? webgpuRun : wasmRun,
    );
    asr = await import("./asr");
  });

  it("retries once on the wasm pipeline when the webgpu run hits an ORT kernel error", async () => {
    setWebgpu(true);
    webgpuRun.mockRejectedValue(new Error(ORT_OVERFLOW));
    wasmRun.mockResolvedValue({ text: "  hello there  " });

    const result = await asr.transcribe(new Blob(["wav"]));

    expect(result.text).toBe("hello there");
    expect(typeof result.duration).toBe("number");
    expect(webgpuRun).toHaveBeenCalledTimes(1);
    expect(wasmRun).toHaveBeenCalledTimes(1);
    const pipelineArgs = pipelineMock.mock.calls.map(([, , options]: [string, string, PipelineOptions]) => options.device);
    expect(pipelineArgs).toEqual(["webgpu", "wasm"]);
    const [, , wasmOptions] = pipelineMock.mock.calls[1] as [string, string, PipelineOptions];
    expect(wasmOptions.dtype).toEqual({ encoder_model: "q8", decoder_model_merged: "q8" });
    expect(wasmRun.mock.calls[0][1]).toEqual({ chunk_length_s: 30, stride_length_s: 5 });
  });

  it("propagates non-GPU errors without attempting a fallback", async () => {
    setWebgpu(true);
    webgpuRun.mockRejectedValue(new Error("network blip while downloading weights"));

    await expect(asr.transcribe(new Blob(["wav"]))).rejects.toThrow("network blip");
    expect(pipelineMock).toHaveBeenCalledTimes(1);
    expect(wasmRun).not.toHaveBeenCalled();
  });

  it("throws AsrError when the wasm retry also hits a GPU-kernel error", async () => {
    setWebgpu(true);
    webgpuRun.mockRejectedValue(new Error(ORT_OVERFLOW));
    wasmRun.mockRejectedValue(
      new Error("failed to call OrtRun(). ERROR_CODE: 1, ERROR_MESSAGE: Out of memory"),
    );

    await expect(asr.transcribe(new Blob(["wav"]))).rejects.toBeInstanceOf(asr.AsrError);
  });

  it("runs wasm directly when WebGPU is unavailable", async () => {
    setWebgpu(false);
    wasmRun.mockResolvedValue({ text: "cpu text" });

    const result = await asr.transcribe(new Blob(["wav"]));

    expect(result.text).toBe("cpu text");
    expect(webgpuRun).not.toHaveBeenCalled();
    const [, , options] = pipelineMock.mock.calls[0] as [string, string, PipelineOptions];
    expect(options.device).toBe("wasm");
  });
});
