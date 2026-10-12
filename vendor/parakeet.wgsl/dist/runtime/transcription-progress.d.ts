/**
 * Two row-equivalent units model the fixed palette-expansion, submission,
 * drain, and readback floor of every physical graph. Retained B1/B8/B19/B40
 * timings support the same deterministic approximation in both precisions.
 */
export declare const TRANSCRIPTION_GRAPH_FIXED_WORK_UNITS = 2;
export declare const TRANSCRIPTION_PRE_DONE_FRACTION = 0.999999;
export interface TranscriptionGraphProgress {
    readonly update: (completedWorkUnits: number, totalWorkUnits: number) => number;
    readonly complete: () => number;
}
/**
 * One monotonic work estimate spanning primary and adaptive repair inference.
 *
 * Physical graph milestones are exact. A streamed primary plan and
 * not-yet-discoverable repair branches are estimated; callers replace those
 * estimates as plans resolve. An increased estimate creates a plateau because
 * the published fraction is clamped to its previous value. Exactly 1 is
 * reserved for finish().
 */
export declare class MonotonicTranscriptionProgress {
    #private;
    constructor(options: {
        readonly totalPrimaryWindows: number;
        readonly batchCapacity: number;
        /** False while streamed PCM has not reached an exact EOF-derived plan. */
        readonly primaryWindowsSealed?: boolean;
    });
    get fraction(): number;
    get isFinished(): boolean;
    get totalPrimaryWindowEstimate(): number;
    get primaryWindowsSealed(): boolean;
    /**
     * Grow the provisional streamed-input primary plan. Every already-started
     * physical graph remains counted exactly; a larger denominator is published
     * as a plateau rather than a backwards step.
     */
    extendPrimaryWindowEstimate(totalPrimaryWindows: number): number;
    /** Replace the provisional streamed-input plan with the exact EOF plan. */
    sealPrimaryWindows(totalPrimaryWindows: number): number;
    /**
     * Replace the unknown repair reserve with currently justified physical
     * waves. A wave is the number of rows that would share one placement pass;
     * packing and fixed graph overhead are derived here rather than in callers.
     */
    setEstimatedRepairWaves(rowCounts: readonly number[]): number;
    /** Register one real physical graph exactly once. */
    beginGraph(options: {
        readonly primaryRows: number;
        readonly repairRows: number;
    }): TranscriptionGraphProgress;
    finish(): number;
}
export declare function graphWeight(activeRows: number): number;
export declare function packedGraphWeight(rows: number, batchCapacity: number): number;
