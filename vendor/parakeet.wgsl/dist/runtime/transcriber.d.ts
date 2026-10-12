import { type TranscriptionSnapshot, type TranscriptionProgress, type TranscriptionResult } from "./protocol.js";
import { type PacedTranscriptUpdate } from "./paced-transcript.js";
export type { AudioDecodingMetrics, ModelLoadPhase, ModelLoadProgress, TranscriptionMetrics, TranscriptionProgress, TranscriptionResult, TranscriptionSnapshot, TranscriptionToken, TranscriptionWord, } from "./protocol.js";
export type { PacedTranscriptTextSplice, PacedTranscriptUpdate, PacedTranscriptWord, PacedTranscriptWordSplice, } from "./paced-transcript.js";
export interface TranscribeOptions {
    /**
     * File name used to identify an in-memory Blob's container when FFmpeg
     * decoding is needed. A File's own non-empty name takes precedence.
     */
    readonly sourceName?: string;
    /**
     * Monotonic overall progress through primary inference and adaptive repair.
     * Scheduled GPU work advances at exact completed execution milestones;
     * undiscovered repair work is estimated, so newly discovered work can pause
     * but never reverse the fraction. Only completion reports one.
     */
    readonly onProgress?: (progress: TranscriptionProgress) => void;
    /**
     * Receives replaceable, timestamped transcript snapshots after each
     * completed primary inference batch and after repair inserts new tokens.
     */
    readonly onPartialResult?: (snapshot: TranscriptionSnapshot) => void;
    /**
     * Receives the same real transcript content as a presentation-paced stream
     * of timestamped word/text splices. Inference and raw snapshot cadence are
     * unchanged. Pending primary words flush when primary inference completes;
     * repair corrections and the exact final update are then immediate. This
     * presentation track never intentionally delays the returned promise.
     */
    readonly onPacedTranscript?: (update: PacedTranscriptUpdate) => void;
    readonly signal?: AbortSignal;
}
/**
 * Main-thread controller for one dedicated Parakeet module worker.
 *
 * Canonical audio is posted as the original Blob/File. Other inputs are
 * decoded into immutable OPFS segments by an isolated worker and streamed to
 * inference. The controller never calls `arrayBuffer()` on a complete input.
 */
export declare class ParakeetTranscriber {
    private readonly worker;
    private readonly lazyLoadOptions;
    private nextRequestId;
    private nextJobId;
    private pendingInitialization;
    private pendingTranscription;
    private ready;
    private disposed;
    private _diagnostics;
    private readonly workerMessageListener;
    private readonly workerErrorListener;
    private constructor();
    get diagnostics(): Readonly<Record<string, unknown>> | null;
    get initialized(): boolean;
    /**
     * Load the capability-selected model only when its complete runtime package
     * is already present in Cache Storage. This never downloads model bytes.
     * Concurrent calls and transcribe() share the same initialization task.
     *
     * @returns true when the model is GPU-resident; false on a cache miss.
     */
    loadCachedModel(): Promise<boolean>;
    transcribe(audio: Blob, options?: TranscribeOptions): Promise<TranscriptionResult>;
    private prepareAndStartTranscription;
    private notifyAudioDecodingStarted;
    /** Request cancellation of the current job, if any. */
    cancel(): boolean;
    dispose(): void;
    private initializeForTranscription;
    private startInitialization;
    private handleWorkerMessage;
    private handleProtocolError;
    private requestCancellation;
    private cancelInitialization;
    private dispatchTranscription;
    private dispatchStreamingTranscription;
    private resolveTranscription;
    private rejectTranscription;
    private settleTranscription;
    private finishTranscription;
    private failAll;
    private terminate;
}
export declare class ParakeetError extends Error {
    readonly code: string;
    constructor(message: string, code: string, options?: ErrorOptions);
}
