export declare const SPEECH_RMS_CEILING: number;
export declare const SPEECH_RMS_FLOOR: number;
export declare const SEAM_GAP_MIN_SPEECH_SECONDS = 0.5;
export interface PcmSampleReader {
    readonly sampleCount: number;
    readSamplesInto(startSample: number, target: Float32Array, targetOffset?: number, sampleCount?: number): Promise<number>;
}
export interface AdaptiveSpeechThreshold {
    readonly threshold: number;
    readonly referenceRms: number;
    readonly nonzeroFrameCount: number;
}
interface ReferenceHighBucket {
    readonly histogram: Uint32Array;
    readonly nonzeroFrameCount: number;
    readonly highBits: number;
    readonly indexWithinHighBucket: number;
}
/**
 * Exact bounded-memory high-radix state for the adaptive speech threshold.
 *
 * Primary PCM windows append only the next globally aligned 80 ms frames.
 * Their overlap is therefore never counted twice. Completion scans any
 * contiguous suffix that was not already resident in the Wasm input arena.
 */
export declare class AdaptiveSpeechRmsAccumulator {
    private readonly histogram;
    private nonzeroFrameCount;
    private nextSample;
    private finished;
    get nextFrameStartSample(): number;
    addContiguousFrameBits(startSample: number, bits: Uint32Array): void;
    addContiguousFrameRms(startSample: number, rms: number): void;
    finishReferenceHighBucket(): ReferenceHighBucket;
    private addRmsBits;
    private requireAppendStart;
    private advance;
}
export declare function adaptiveSpeechRmsThreshold(referenceRms: number): number;
/**
 * Find the end of the final speech-bearing 80 ms frame. An all-sub-floor file
 * deliberately returns EOF unchanged, matching FluidAudio's final-tail rule.
 */
export declare function findSpeechEndSample(reader: PcmSampleReader, signal?: AbortSignal): Promise<number>;
/**
 * Streaming, bounded-memory equivalent of FluidAudio's exact sorted-Float p75
 * selection. Positive IEEE-754 Float32 values have the same ordering as their
 * unsigned bit patterns, so two 16-bit radix passes locate the exact selected
 * value without retaining one RMS value per frame.
 */
export declare function scanAdaptiveSpeechThreshold(reader: PcmSampleReader, signal?: AbortSignal): Promise<AdaptiveSpeechThreshold>;
/**
 * Production threshold scan. When the selected high-16 Float32 bucket proves
 * that every possible p75 value clamps to the same floor or ceiling, avoid
 * the second full-file radix pass. Unclamped buckets still resolve the exact
 * low bits, so the returned threshold is identical to
 * `scanAdaptiveSpeechThreshold(...).threshold`.
 */
export declare function scanAdaptiveSpeechThresholdOnly(reader: PcmSampleReader, signal?: AbortSignal): Promise<number>;
/**
 * Finish an incrementally accumulated high-radix pass and preserve the exact
 * low-16 second pass for the uncommon unclamped selected bucket.
 */
export declare function completeAdaptiveSpeechThresholdOnly(reader: PcmSampleReader, accumulator: AdaptiveSpeechRmsAccumulator, signal?: AbortSignal): Promise<number>;
/** Cumulative duration of complete 80 ms frames above the adaptive gate. */
export declare function speechLikeSeconds(reader: PcmSampleReader, startSample: number, endSample: number, threshold: number, signal?: AbortSignal): Promise<number>;
export {};
