import { type StatelessAudioWindow, type StatelessWindowPlan } from "./chunking";
import { type ModelLoadSource, type ModelLoadProgress, type ParakeetWorkerMessage, type WorkerLoadConfiguration } from "./protocol";
import { type TimedToken } from "./stitch";
export interface EngineStageTimings {
    readonly frontendMs?: number;
    readonly encoderMs?: number;
    readonly decoderMs?: number;
}
export interface EngineWindowResult {
    /**
     * Tokens must be sorted and expressed in global input-sample coordinates.
     * The window plan contains the offset needed to globalize model timestamps.
     */
    readonly tokens: readonly TimedToken[];
    readonly timings?: EngineStageTimings;
}
/**
 * Bounded-memory writer supplied by the engine for one logical batch.
 *
 * `samples` is the current reusable source PCM window. The shell obtains the
 * getter for every plan, decodes directly into it, and calls `commit`
 * synchronously before reusing the same bounded backing store.
 */
export interface EngineWindowBatchWriter {
    readonly samples: Float32Array<ArrayBuffer>;
    commit(window: StatelessWindowPlan, batchIndex: number, rmsFrameRange?: EngineRmsFrameRange): void | Uint32Array<ArrayBuffer>;
    finish(): void | Promise<void>;
    abort(): void | Promise<void>;
}
export interface EngineRmsFrameRange {
    /** Sample offset within the currently resident PCM window. */
    readonly sampleOffset: number;
    /** Number of complete ordered 80 ms RMS frames to emit. */
    readonly frameCount: number;
}
export interface EngineBatchExecutionProgress {
    readonly completedWorkUnits: number;
    readonly totalWorkUnits: number;
}
/**
 * Boundary between the streaming worker shell and the raw WebGPU backend.
 *
 * The backend owns model tensors and GPU resources. The shell owns WAV
 * parsing, fixed-size long-form windows, stitching, cancellation and metrics.
 */
export interface ParakeetInferenceEngine {
    readonly diagnostics: Readonly<Record<string, unknown> & {
        readonly fbankHopSamples: number;
    }>;
    /** Maximum number of fixed audio windows the shell should keep live. */
    readonly preferredBatchSize: number;
    /** Number of ordered GPU batches the backend can safely keep in flight. */
    readonly maxInFlightBatches: number;
    /** Reset per-file streaming state before the first window is submitted. */
    beginTranscription(): void | Promise<void>;
    /**
     * Expose one reusable input item. `commit` must consume it synchronously
     * before the shell decodes the next window into the same view.
     */
    prepareWindowBatch(batchSize: number, sampleCount: number): EngineWindowBatchWriter;
    /**
     * Returns one result for each input window, in the same order.
     * A cardinality mismatch is treated as an engine contract violation.
     * Every `window.samples` view aliases the engine's reusable prepared-batch
     * storage. The engine must consume samples in `commit` and retain any
     * derived state it needs here.
     */
    transcribeWindows(windows: readonly StatelessAudioWindow[], signal: AbortSignal, onExecutionProgress?: (progress: EngineBatchExecutionProgress) => void): Promise<readonly EngineWindowResult[]>;
    decodeTokenIds(tokenIds: readonly number[]): string;
    tokenPiece(tokenId: number): string | undefined;
    dispose(): void | Promise<void>;
}
export interface EngineFactoryContext {
    readonly modelSource: ModelLoadSource;
    readonly onProgress?: (progress: ModelLoadProgress) => void;
    readonly signal?: AbortSignal;
}
export type ParakeetInferenceEngineFactory = (configuration: WorkerLoadConfiguration, context: EngineFactoryContext) => Promise<ParakeetInferenceEngine>;
export type ParakeetWorkerPostMessage = (message: ParakeetWorkerMessage) => void;
export interface ParakeetWorkerScope {
    postMessage(message: ParakeetWorkerMessage): void;
    addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
}
export interface ParakeetWorkerRuntimeOptions {
    readonly postMessage: ParakeetWorkerPostMessage;
    readonly engineFactory: ParakeetInferenceEngineFactory;
    readonly now?: () => number;
}
/**
 * Testable message runtime used by the dedicated module worker.
 *
 * `handleMessage` returns the work Promise for direct tests, while an installed
 * worker intentionally does not await it so cancellation messages remain
 * responsive during inference.
 */
export declare class ParakeetWorkerRuntime {
    private readonly postMessage;
    private readonly engineFactory;
    private readonly now;
    private engine;
    private initialization;
    private active;
    private preparedStream;
    private initializationStartedAtMs;
    private initializationEndedAtMs;
    constructor(options: ParakeetWorkerRuntimeOptions);
    handleMessage(message: unknown): Promise<void>;
    private initialize;
    private cancelInitialization;
    private prepareStream;
    private discardStream;
    private releasePreparedStream;
    private transcribeStream;
    private transcribe;
    private runStreamingTranscription;
    private runTranscription;
    private cancel;
    private postRuntimeError;
}
export declare function installParakeetWorker(scope: ParakeetWorkerScope, engineFactory: ParakeetInferenceEngineFactory): ParakeetWorkerRuntime;
