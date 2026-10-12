export interface GpuTimestampSample {
    readonly label: string;
    readonly startNanoseconds: bigint;
    readonly endNanoseconds: bigint;
    readonly durationNanoseconds: number;
    readonly durationMilliseconds: number;
}
/**
 * Return the elapsed GPU time from the beginning of `firstLabel` through the
 * end of `lastLabel`. A timestamp-query feature bit only says that queries can
 * be encoded; Metal/Dawn can still return unavailable (zero) samples. Treat
 * those, reversed samples, and non-finite Number conversions as unavailable so
 * callers can use a wall-clock fallback instead of reporting zero work.
 */
export declare function gpuTimestampSpanMilliseconds(samples: readonly GpuTimestampSample[], firstLabel: string, lastLabel: string): number | undefined;
/**
 * Optional pass-level GPU timing. Constructing this class never requires
 * timestamp-query; on devices without the enabled feature it becomes a no-op
 * and callers can use wall-clock timing.
 */
export declare class GpuTimestampRecorder {
    readonly supported: boolean;
    private readonly maxSamples;
    private readonly querySet?;
    private readonly resolveBuffer?;
    private readonly readbackBuffer?;
    private readonly byteCapacity;
    private labels;
    private resolvedSampleCount;
    private state;
    constructor(device: GPUDevice, maxSamples: number, 
    /**
     * Hard kill switch for runtimes where merely encoding timestamp queries
     * is unsafe. When false, feature probing and all query/buffer allocation
     * are skipped even if the device exposes timestamp-query.
     */
    enabled?: boolean);
    reset(): void;
    /**
     * Return timestamp writes to spread into a compute-pass descriptor.
     *
     * @example
     * const writes = timestamps.allocate("encoder.layer.0");
     * const pass = encoder.beginComputePass(writes ? { timestampWrites: writes } : {});
     */
    allocate(label: string): GPUComputePassTimestampWrites | undefined;
    /**
     * Encode query resolution before submitting the command buffer.
     */
    resolve(encoder: GPUCommandEncoder): void;
    /**
     * Read timestamps after the command buffer containing resolve() is submitted.
     * WebGPU timestamp values are nanoseconds.
     */
    read(): Promise<GpuTimestampSample[]>;
    destroy(): void;
    private assertNotDestroyed;
}
