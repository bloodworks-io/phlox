export type TranscriptionPhase = "transcribing" | "done";
/** Bounded-memory audio decoding, including work overlapped with inference. */
export interface AudioDecodingMetrics {
    /** Whether the packaged FFmpeg core decoded the supplied recording. */
    readonly applied: boolean;
    /**
     * FFmpeg worker startup through decoded EOF when applied; otherwise the
     * bounded canonical-WAV inspection. This span is reported separately and is
     * never added wholesale to transcription wall time. Any uncovered PCM wait
     * after transcription starts is naturally already inside `totalMs`.
     */
    readonly wallMs: number;
    /** Sum of time executing bounded native decoder steps. */
    readonly activeMs: number;
    /** Source Blob/container bytes. */
    readonly inputByteLength: number;
    /** Canonical signed PCM16 payload bytes, excluding any WAV container. */
    readonly outputByteLength: number;
    /** Decoder wall time concurrent with model loading or transcription. */
    readonly overlapMs: number;
    /** Total wall time the inference scheduler awaited decoded PCM or EOF. */
    readonly pcmWaitMs: number;
    /** PCM-wait tail not covered by an already-submitted inference graph. */
    readonly pcmStarvationMs: number;
    /** Number of PCM waits with a positive uncovered starvation tail. */
    readonly pcmStarvationCount: number;
}
export interface PartialTranscriptionMetrics {
    readonly audioDecoding: AudioDecodingMetrics;
    readonly audioDurationSeconds: number;
    readonly processedAudioSeconds: number;
    readonly elapsedMs: number;
    readonly audioReadMs: number;
    readonly inferenceMs: number;
    readonly frontendMs: number;
    readonly encoderMs: number;
    readonly decoderMs: number;
    /** Processed audio seconds divided by elapsed wall seconds. */
    readonly speedFactor: number;
    /** Fully decoded and merged primary windows, never fractional work. */
    readonly completedWindows: number;
    /** Exact primary total, or zero while streamed PCM has not reached EOF. */
    readonly totalWindows: number;
    /** Energy-qualified unique inter-token gaps examined by repair. */
    readonly repairGapProbes: number;
    /** Physical gap-start and centered repair windows actually decoded. */
    readonly repairWindowDecodes: number;
    /** Repair rounds that contained at least one decoder probe. */
    readonly repairRounds: number;
    /** Insertion-only tokens recovered from all repair rounds. */
    readonly recoveredTokens: number;
}
export type TranscriptionBatchClass = "primary" | "mixed" | "repair";
export declare const TRANSCRIPTION_BATCH_TIMELINE_LIMIT = 11;
/**
 * Compact critical-path record for one physical inference submission.
 *
 * Offsets are relative to transcription start. `gpuIntervalMs` is the
 * engine's submit-to-readback wall interval; it is not a timestamp-query
 * result and may overlap another logical in-flight slot.
 */
export interface TranscriptionBatchTimelineRecord {
    readonly submissionIndex: number;
    readonly batchClass: TranscriptionBatchClass;
    readonly activeRows: number;
    readonly primaryRows: number;
    readonly repairRows: number;
    readonly officialRepairRows: number;
    readonly finalPrimaryPrefetchRows: number;
    readonly crossRoundPrefetchRows: number;
    readonly preparationStartedOffsetMs: number;
    readonly submissionStartedOffsetMs: number;
    readonly completionOffsetMs: number;
    readonly preparationMs: number;
    readonly submissionToCompletionMs: number;
    readonly frontendMs: number;
    readonly gpuIntervalMs: number;
}
export interface TranscriptionPhaseTimings {
    readonly trailingSpeechScanMs: number;
    readonly adaptiveThresholdScanMs: number;
    readonly gapEnergyScanMs: number;
    /** Exact seam merges performed as primary windows complete. */
    readonly incrementalStitchMs: number;
    readonly prefixStitchMs: number;
    readonly finalStitchMs: number;
    readonly repairPlanningMs: number;
    readonly repairSplicingMs: number;
    /** Optional snapshot serialization and worker-message submission time. */
    readonly partialResultMs: number;
    readonly tokenDecodeMs: number;
}
export interface TranscriptionProgress {
    readonly phase: TranscriptionPhase;
    /**
     * Monotonic overall fraction for the complete transcription, including
     * adaptive seam repair. Scheduled GPU work advances at exact completed
     * execution milestones; a streamed input's pre-EOF primary plan and repair
     * work that has not been discovered yet are estimated. Discovering more work
     * may temporarily plateau the fraction, but it never decreases. Only the
     * `done` phase reports one.
     * `completedWindows` changes only after primary decoder output has been
     * received and merged.
     */
    readonly fraction: number;
    readonly metrics: PartialTranscriptionMetrics;
}
export interface TranscriptionToken {
    readonly tokenId: number;
    readonly startSeconds: number;
    readonly endSeconds: number;
}
export interface TranscriptionWord {
    readonly text: string;
    readonly startSeconds: number;
    readonly endSeconds: number;
}
/**
 * Provisional transcript assembled from every completed primary batch.
 *
 * A later overlapping window may revise the newest seam, and bounded seam
 * repair may insert recovered words at an earlier timestamp. Consumers must
 * replace the prior snapshot rather than treating updates as append-only.
 */
export interface TranscriptionSnapshot {
    readonly revision: number;
    readonly text: string;
    readonly tokens: readonly TranscriptionToken[];
    readonly words: readonly TranscriptionWord[];
    readonly audioDurationSeconds: number;
    readonly processedAudioSeconds: number;
}
export interface TranscriptionMetrics extends PartialTranscriptionMetrics {
    readonly stitchingMs: number;
    /**
     * Sequential post-primary repair tail. Repair inference co-batched with a
     * primary or earlier required repair graph is intentionally excluded.
     */
    readonly repairMs: number;
    /** Physical repair rows decoded before the official pass requested them. */
    readonly repairPrefetchWindowDecodes: number;
    /** Unique prefetched rows later consumed by the official repair pass. */
    readonly repairPrefetchCacheHits: number;
    /** Prefetched rows never requested by the official repair pass. */
    readonly repairPrefetchUnusedDecodes: number;
    /**
     * First physical submissions retained for critical-path attribution.
     * Storage is capped independently of input duration.
     */
    readonly batchSubmissionTimeline: readonly TranscriptionBatchTimelineRecord[];
    /** Physical submissions beyond the bounded retained timeline. */
    readonly batchSubmissionTimelineOmitted: number;
    readonly phaseTimings: TranscriptionPhaseTimings;
    readonly totalMs: number;
}
export interface TranscriptionResult {
    readonly text: string;
    readonly tokens: readonly TranscriptionToken[];
    readonly words: readonly TranscriptionWord[];
    readonly metrics: TranscriptionMetrics;
}
export type ModelLoadPhase = "webgpu" | "wasm" | "manifest" | "weights" | "tokenizer" | "cache" | "retry" | "ready" | "pipelines";
export interface ModelLoadProgress {
    readonly phase: ModelLoadPhase;
    readonly fraction: number;
    readonly loadedBytes?: number;
    readonly totalBytes?: number;
    readonly message?: string;
    readonly attempt?: number;
    readonly maxAttempts?: number;
}
/** Whether initialization may use the network for missing model assets. */
export type ModelLoadSource = "cache-only" | "cache-or-network";
export interface WorkerLoadConfiguration {
    /** FP16 package manifest selected when shader-f16 is available. */
    readonly fp16ModelUrl: string;
    /** FP32 package manifest selected only when shader-f16 is unavailable. */
    readonly fp32ModelUrl: string;
    readonly wasmUrl: string;
}
export interface SerializedWorkerError {
    readonly name: string;
    readonly message: string;
    readonly code: string;
    readonly stack?: string;
}
export interface InitializeWorkerMessage {
    readonly type: "initialize";
    readonly requestId: number;
    /** Avoid model-load progress traffic when the caller did not subscribe. */
    readonly reportProgress: boolean;
    readonly modelSource: ModelLoadSource;
    readonly configuration: WorkerLoadConfiguration;
}
export interface TranscribeWorkerMessage {
    readonly type: "transcribe";
    readonly jobId: number;
    /** Blob/File is sent by structured clone. It is never converted wholesale. */
    readonly audio: Blob;
    /** Main-thread preparation metrics for the canonical Blob sent above. */
    readonly audioDecoding: AudioDecodingMetrics;
    /** Avoid progress traffic when the caller did not subscribe. */
    readonly reportProgress: boolean;
    /** Build and post provisional timestamped transcript snapshots. */
    readonly reportPartialResults: boolean;
    /**
     * Post one primary-complete signal for a paced subscriber without enabling
     * the independent fine-progress stream.
     */
    readonly reportPacedTranscriptBoundary: boolean;
}
/** Attach a decoder data port before model initialization starts. */
export interface PrepareStreamingAudioWorkerMessage {
    readonly type: "prepare-stream";
    readonly jobId: number;
    readonly port: MessagePort;
    readonly inputByteLength: number;
    /** Best-effort 16 kHz output count; exact PCM length remains EOF-dependent. */
    readonly estimatedSampleCount: number | null;
}
export interface TranscribeStreamingWorkerMessage {
    readonly type: "transcribe-stream";
    readonly jobId: number;
    readonly reportProgress: boolean;
    readonly reportPartialResults: boolean;
    readonly reportPacedTranscriptBoundary: boolean;
}
export interface DiscardStreamingAudioWorkerMessage {
    readonly type: "discard-stream";
    readonly jobId: number;
}
export interface CancelWorkerMessage {
    readonly type: "cancel";
    readonly jobId: number;
}
export interface CancelInitializationWorkerMessage {
    readonly type: "cancel-initialization";
    readonly requestId: number;
}
export type ParakeetClientMessage = InitializeWorkerMessage | TranscribeWorkerMessage | PrepareStreamingAudioWorkerMessage | TranscribeStreamingWorkerMessage | DiscardStreamingAudioWorkerMessage | CancelInitializationWorkerMessage | CancelWorkerMessage;
export interface WorkerLoadProgressMessage {
    readonly type: "load-progress";
    readonly requestId: number;
    readonly progress: ModelLoadProgress;
}
export interface WorkerReadyMessage {
    readonly type: "ready";
    readonly requestId: number;
    readonly diagnostics: Readonly<Record<string, unknown>>;
}
export interface WorkerInitializationCancelledMessage {
    readonly type: "initialization-cancelled";
    readonly requestId: number;
}
export interface WorkerTranscriptionProgressMessage {
    readonly type: "progress";
    readonly jobId: number;
    readonly progress: TranscriptionProgress;
}
export interface WorkerPartialResultMessage {
    readonly type: "partial-result";
    readonly jobId: number;
    readonly snapshot: TranscriptionSnapshot;
}
export interface WorkerPacedTranscriptFlushMessage {
    readonly type: "paced-transcript-flush";
    readonly jobId: number;
}
export interface WorkerResultMessage {
    readonly type: "result";
    readonly jobId: number;
    readonly result: TranscriptionResult;
}
export interface WorkerCancelledMessage {
    readonly type: "cancelled";
    readonly jobId: number;
}
export interface WorkerErrorMessage {
    readonly type: "error";
    readonly requestId?: number;
    readonly jobId?: number;
    readonly error: SerializedWorkerError;
}
export type ParakeetWorkerMessage = WorkerLoadProgressMessage | WorkerReadyMessage | WorkerInitializationCancelledMessage | WorkerTranscriptionProgressMessage | WorkerPartialResultMessage | WorkerPacedTranscriptFlushMessage | WorkerResultMessage | WorkerCancelledMessage | WorkerErrorMessage;
export declare function isParakeetClientMessage(value: unknown): value is ParakeetClientMessage;
export declare function isParakeetWorkerMessage(value: unknown): value is ParakeetWorkerMessage;
export declare function serializeWorkerError(error: unknown, fallbackCode?: string): SerializedWorkerError;
