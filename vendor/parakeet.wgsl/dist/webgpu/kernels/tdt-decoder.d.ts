import type { ParakeetGpuPackage } from "../../model/package";
import type { ArenaSlice } from "../arena";
import { GpuActivationArena } from "../arena";
import { type ParakeetExecutionProfile } from "../capabilities";
export declare const TDT_DECODER_OVERFLOW = 1;
export declare const TDT_PAIRED_WORKGROUP_STORAGE_BYTES = 25808;
export declare const TDT_PORTABLE_PAIRED_WORKGROUP_STORAGE_BYTES = 29776;
export interface TdtDecoderExecutionPlan {
    readonly workgroupCount: number;
    readonly predictorScratchByteLength: number;
}
export declare function planTdtDecoderExecution(batchSize: number): TdtDecoderExecutionPlan;
export interface TdtDecoderDescriptor {
    readonly label?: string;
    /** Profile scalar [batch, frames, 640], after encoder_projector. */
    readonly encoderProjected: ArenaSlice;
    /** u32 [batch]. */
    readonly encodedLengths: ArenaSlice;
    /** u32 [batch], first encoder frame consumed by each cold decoder. */
    readonly decodeStarts: ArenaSlice;
    /** u32 [batch], exclusive encoder-frame boundary for each decoder. */
    readonly decodeEnds: ArenaSlice;
    /** u32 [batch], nonzero runs the shared bounded end-of-stream flush. */
    readonly flushFinals: ArenaSlice;
    /** f32 [batch, 4, 640], used for committed h0/c0/h1/c1. */
    readonly state: ArenaSlice;
    /** f32 [batch, 5, 640], candidate h0/c0/h1/c1 and projection. */
    readonly predictorScratch: ArenaSlice;
    /** u32 [batch, maxTokens]. */
    readonly tokens: ArenaSlice;
    /** u32 [batch, maxTokens], local encoder-frame emission timestamps. */
    readonly tokenFrames: ArenaSlice;
    /** u32 [batch, maxTokens], selected TDT durations. */
    readonly tokenDurations: ArenaSlice;
    /** u32 [batch * 2]: counts followed by status flags. */
    readonly metadata: ArenaSlice;
    readonly batchSize: number;
    readonly frames: number;
    readonly maxTokens: number;
}
export declare class TdtDecoderDispatch {
    readonly label: string;
    private readonly device;
    private readonly pipeline;
    private readonly bindGroup;
    private readonly uniformBuffer;
    private readonly batchCapacity;
    private destroyed;
    private activeBatchSize;
    constructor(label: string, device: GPUDevice, pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, uniformBuffer: GPUBuffer, batchCapacity: number);
    encode(encoder: GPUCommandEncoder, timestampWrites?: GPUComputePassTimestampWrites, activeBatchSize?: number): void;
    destroy(): void;
}
/**
 * Greedy TDT decoding in one persistent workgroup per pair of audio windows.
 *
 * The two sequences share each vocabulary-head weight load while preserving
 * independent profile-native accumulator chains and decoder control. FP16
 * retains the established shader exactly; FP32 uses raw FP32 weights,
 * projection inputs, LSTM accumulators, and vocabulary-head accumulators. A
 * single predictor workspace is reused sequentially; candidate states and
 * projections remain in bounded f32 arena scratch while blanks advance
 * through encoder frames. Keeping the complete autoregressive loop on the GPU
 * avoids a command submission and CPU readback for every token decision.
 */
export declare class PersistentTdtDecoderKernel {
    private readonly device;
    private readonly arena;
    private readonly decoderWeights;
    private readonly pipeline;
    private readonly layout;
    private readonly weights;
    private readonly executionProfile;
    private constructor();
    static create(device: GPUDevice, arena: GpuActivationArena, model: ParakeetGpuPackage, executionProfile?: ParakeetExecutionProfile): Promise<PersistentTdtDecoderKernel>;
    createDispatch(descriptor: TdtDecoderDescriptor): TdtDecoderDispatch;
}
export declare function tdtDecoderWgsl(): string;
export declare function tdtDecoderFp32Wgsl(): string;
export declare function tdtDecoderWgslForProfile(executionProfile?: ParakeetExecutionProfile): string;
