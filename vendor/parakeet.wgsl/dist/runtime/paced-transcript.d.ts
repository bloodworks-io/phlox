import type { TranscriptionResult, TranscriptionSnapshot, TranscriptionWord } from "./protocol.js";
export declare const PACED_TRANSCRIPT_FRAME_MILLISECONDS: number;
export declare const PACED_TRANSCRIPT_EWMA_ALPHA = 0.35;
export declare const PACED_TRANSCRIPT_MIN_INTERVAL_MILLISECONDS = 100;
export declare const PACED_TRANSCRIPT_MAX_INTERVAL_MILLISECONDS = 30000;
export interface PacedTranscriptTextSplice {
    /** UTF-16 code-unit offset in the text before this update. */
    readonly startOffset: number;
    readonly deleteCount: number;
    readonly insertText: string;
}
export interface PacedTranscriptWord extends TranscriptionWord {
    /** Half-open UTF-16 code-unit range after this update. */
    readonly startOffset: number;
    readonly endOffset: number;
}
export interface PacedTranscriptWordSplice {
    readonly startIndex: number;
    readonly deleteCount: number;
    readonly insertWords: readonly PacedTranscriptWord[];
}
/**
 * One presentation-paced mutation of the derived transcript.
 *
 * `revision` belongs to this paced delivery track. Several paced revisions
 * can share one authoritative raw `sourceRevision`. The terminal
 * reconciliation uses the next synthetic source revision.
 */
export interface PacedTranscriptUpdate {
    readonly revision: number;
    readonly sourceRevision: number;
    readonly textSplice: PacedTranscriptTextSplice;
    readonly wordSplice: PacedTranscriptWordSplice;
    readonly audioDurationSeconds: number;
    readonly processedAudioSeconds: number;
    readonly isFinal: boolean;
}
export interface PacedTranscriptScheduler {
    now(): number;
    /**
     * Schedule callback asynchronously after at least delayMilliseconds.
     * The returned handle must not be undefined.
     */
    schedule(callback: () => void, delayMilliseconds: number): object | number;
    cancel(handle: object | number): void;
}
export interface PacedTranscriptDeliveryOptions {
    readonly onUpdate: (update: PacedTranscriptUpdate) => void;
    readonly onError?: (error: unknown) => void;
    readonly scheduler?: PacedTranscriptScheduler;
}
/**
 * Derives a smooth, timestamped word-delivery track from authoritative raw
 * snapshots. It never changes inference cadence or requests additional
 * transcript snapshots; a subscriber enables one primary-complete boundary
 * signal.
 */
export declare class PacedTranscriptDelivery {
    private readonly onUpdate;
    private readonly onError;
    private readonly scheduler;
    private readonly startedAt;
    private target;
    private displayedText;
    private displayedWords;
    private lastSourceRevision;
    private presentationRevision;
    private lastSourceArrivalAt;
    private estimatedIntervalMs;
    private cycleStartedAt;
    private cycleStartWordCount;
    private cycleTargetWordCount;
    private cycleDurationMs;
    private scheduledFrame;
    private immediateDelivery;
    private finalRequested;
    private finalCompletion;
    private closed;
    private failed;
    private failure;
    private lastClockAt;
    constructor(options: PacedTranscriptDeliveryOptions);
    get pendingWordCount(): number;
    get sourceIntervalEstimateMilliseconds(): number | undefined;
    get hasScheduledFrame(): boolean;
    pushSnapshot(snapshot: TranscriptionSnapshot, arrivalAtMilliseconds?: number): void;
    /**
     * Reveal the complete latest primary target and make every later repair or
     * final target immediate. This is idempotent and also works before the first
     * source snapshot arrives.
     */
    flushPendingAndDisablePacing(): void;
    finish(result: TranscriptionResult): Promise<void>;
    cancel(reason?: unknown): void;
    private observeSourceArrival;
    private setTarget;
    private startDeliveryCycle;
    private scheduleNextFrame;
    private deliverFrame;
    private appendTargetWords;
    private revealTargetFully;
    private emitSplice;
    private cancelScheduledFrame;
    private fail;
    private readClock;
}
