import { ParakeetTranscriber, type ModelLoadProgress } from "./runtime/transcriber.js";
export interface ParakeetModelUrls {
    /** Canonical FP16 manifest, selected only when shader-f16 is available. */
    readonly fp16: string | URL;
    /** Canonical FP32 manifest, selected only when shader-f16 is unavailable. */
    readonly fp32: string | URL;
}
export type ParakeetModelPrecision = "fp16" | "fp32";
export type ParakeetKernelBackend = "subgroups" | "portable";
/** Capability-derived execution profile fixed for a transcriber's lifetime. */
export interface ParakeetExecutionProfile {
    readonly precision: ParakeetModelPrecision;
    readonly kernelBackend: ParakeetKernelBackend;
    readonly requiredFeatures: readonly ("shader-f16" | "subgroups")[];
}
export declare const DEFAULT_MODEL_URLS: Readonly<ParakeetModelUrls>;
export interface CreateTranscriberOptions {
    /** Override one or both canonical package locations for self-hosting. */
    readonly modelUrls?: Partial<ParakeetModelUrls>;
    /** Model-load events from the first initialization that needs the model. */
    readonly onLoadProgress?: (progress: ModelLoadProgress) => void;
    /** Override the streaming filter-bank Wasm URL for unusual bundlers/CSP. */
    readonly wasmUrl?: string | URL;
    /** Override construction of the WebGPU inference worker. */
    readonly workerFactory?: () => Worker;
}
export interface ParakeetAdapterSummary {
    readonly vendor: string;
    readonly architecture: string;
    readonly device: string;
    readonly description: string;
    readonly isFallbackAdapter?: boolean;
}
export interface ParakeetSupport {
    readonly supported: boolean;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
    readonly executionProfile: ParakeetExecutionProfile | null;
    readonly adapter: ParakeetAdapterSummary | null;
    /** Optional compressed/container input support; canonical WAV is independent. */
    readonly audioDecoding: {
        readonly available: boolean;
        readonly reason?: string;
    };
}
export interface ModelCacheInfo {
    /** Whether this browser context exposes Cache Storage. */
    readonly supported: boolean;
    /** Number of parakeet.wgsl-managed model objects stored for this origin. */
    readonly assetCount: number;
    /** Sum of the stored objects' pinned byte lengths. */
    readonly sizeBytes: number;
}
/**
 * Construct a reusable transcriber without requesting WebGPU or downloading
 * model bytes. Optional loadCachedModel() warmup is strictly model-network-free.
 * Otherwise the first transcribe() call prepares the audio, performs
 * capability selection, opens the selected persistent cache, downloads only
 * that precision when needed, compiles the fixed graph, and transcribes it.
 */
export declare function createTranscriber(options?: CreateTranscriberOptions): ParakeetTranscriber;
/**
 * Perform a network-free adapter and OPFS-root support check without creating
 * a GPU device. The worker repeats the authoritative execution-profile
 * selection when its first transcription initializes.
 */
export declare function checkSupport(): Promise<ParakeetSupport>;
export declare function getModelCacheInfo(): Promise<ModelCacheInfo>;
/**
 * Remove every parakeet.wgsl-managed model object from this origin. A live
 * transcriber keeps its already uploaded GPU model until dispose() is called.
 */
export declare function deleteCachedModels(): Promise<void>;
/**
 * Return whether an audio Blob will use the packaged FFmpeg decoding
 * path. This performs only bounded header reads and no network or OPFS I/O.
 */
export declare function requiresAudioDecoding(audio: Blob): Promise<boolean>;
