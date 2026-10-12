export declare const PARAKEET_FBANK_BINS: 128;
export declare const PARAKEET_FBANK_HOP_SAMPLES: 160;
export declare const PARAKEET_FBANK_MAX_INPUT_SAMPLES: 240000;
export declare const PARAKEET_FBANK_MAX_FRAMES: 1501;
export declare const PARAKEET_FBANK_MAX_BATCH = 40;
export declare const PARAKEET_FBANK_RMS_FRAME_SAMPLES: number;
export declare const PARAKEET_FBANK_MAX_RMS_FRAMES: number;
export interface ParakeetFbankMemoryStats {
    readonly heapBytes: number;
    readonly inputCapacitySamples: number;
    readonly outputCapacityValues: number;
    readonly maxBatchSize: number;
    readonly maxInputSamples: number;
    readonly maxFramesPerWindow: number;
    readonly rmsFrameSamples: number;
    readonly maxRmsFramesPerWindow: number;
}
export interface ParakeetFbankItem {
    /**
     * Feature-major `[128, frameCount]` data. This aliases one fixed Wasm output
     * item and must be uploaded or copied before computing the next item.
     */
    readonly data: Float32Array<ArrayBuffer>;
    readonly batchIndex: number;
    readonly binCount: typeof PARAKEET_FBANK_BINS;
    readonly frameCount: number;
    /** Valid lengths before the three stride-2 subsampling convolutions. */
    readonly validFrameCount: number;
    readonly reusedRawFrames: number;
    readonly layout: "feature-frame";
}
export interface FbankItemComputeOptions {
    /**
     * Per-item advance, in fixed-hop frames, from the immediately
     * preceding window. Item zero may refer to the final window of the previous
     * call.
     *
     * Set zero unless the PCM overlap is known to be identical. The native
     * kernel still recomputes three frames at both changed boundaries.
     */
    readonly reusableFrameShift?: number;
    /**
     * Real (non-right-padded) samples for each fixed-size model input. The model
     * normalizes over floor(validSamples / hop) frames and zeros the
     * remaining physical centered-STFT frames.
     */
    readonly validSampleCount?: number;
}
export interface FbankWindowDescriptor {
    readonly startSample: number;
    readonly sampleCount: number;
    /** Real source samples before right padding. */
    readonly validSampleCount?: number;
}
/**
 * Derive a safe native reuse hint for two equal-length sliding windows.
 *
 * A zero result means the windows must be computed independently. The native
 * kernel applies the additional boundary-frame exclusion.
 */
export declare function reusableFrameShiftForWindows(previous: FbankWindowDescriptor | undefined, current: FbankWindowDescriptor): number;
export declare function parakeetFeatureFrameCount(sampleCount: number): number;
export declare function parakeetValidFeatureFrameCount(sampleCount: number): number;
/**
 * Standalone SIMD Wasm frontend for the fixed 240,000-sample, hop-160 source
 * timeline, which produces the model's 1,501-frame physical input.
 *
 * The module has no Emscripten JS glue, allocator, filesystem, or growing
 * memory. One input/output item is reused across a logical batch; callers
 * decode directly into the input and upload each output before advancing.
 */
export declare class ParakeetFbankWasm {
    readonly memoryStats: ParakeetFbankMemoryStats;
    readonly hopSamples: number;
    private exports;
    private input;
    private output;
    private rmsBits;
    private activeBatch;
    private constructor();
    static create(wasmUrl: string | URL, signal?: AbortSignal): Promise<ParakeetFbankWasm>;
    /** Instantiate caller-supplied bytes, primarily for Node/Vitest validation. */
    static fromBytes(bytes: BufferSource): Promise<ParakeetFbankWasm>;
    static fromInstance(instance: WebAssembly.Instance): ParakeetFbankWasm;
    /**
     * Begin a logical batch and return its single reusable PCM input item.
     * Decode one window, call `computePreparedItem`, upload/copy that output,
     * then reuse this same view for the next item.
     */
    beginPreparedBatch(batchSize: number, sampleCount: number): Float32Array<ArrayBuffer>;
    /**
     * Transform the window already written to the reusable input item.
     *
     * The returned feature view aliases Wasm memory and must be consumed before
     * the next item is computed.
     */
    computePreparedItem(batchIndex: number, options?: FbankItemComputeOptions): ParakeetFbankItem;
    /**
     * Compute exact ordered-Float32 RMS bit patterns for complete 80 ms frames
     * in the PCM item currently resident in the fixed input arena.
     *
     * The returned view aliases one small Wasm scratch and must be consumed
     * before the next call.
     */
    computeRmsBits(sampleOffset: number, frameCount: number): Uint32Array<ArrayBuffer>;
    finishPreparedBatch(): void;
    compute(samples: Float32Array, reusableFrameShift?: number): ParakeetFbankItem;
    resetReuse(): void;
    dispose(): void;
    private validateShape;
    private requireExports;
    private requireInput;
    private requireOutput;
    private requireRmsBits;
    private requireActiveBatch;
}
