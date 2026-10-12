import type { GpuTensor } from "../../model/package";
import type { ArenaSlice } from "../arena";
import { GpuActivationArena } from "../arena";
import { type ParakeetExecutionProfile } from "../capabilities";
import type { EncoderDispatchShape } from "./execution-shape";
export declare const CONFORMER_CONV_CHANNELS = 1024;
export declare const CONFORMER_CONV_POINTWISE_CHANNELS = 2048;
export declare const CONFORMER_CONV_KERNEL_SIZE = 9;
export declare const CONFORMER_DEPTHWISE_WEIGHT_LAYOUT = "kernel-channel-vec4";
export declare const CONFORMER_FOLDED_BATCH_NORM_LAYOUT = "channel";
export declare const CONFORMER_CONV_PARAMETER_BYTES = 16;
export interface ConformerConvShape {
    readonly batchSize: number;
    readonly frames: number;
}
export interface ConformerConvPlan extends ConformerConvShape {
    readonly rows: number;
    readonly inputByteLength: number;
    readonly outputByteLength: number;
    readonly validLengthsByteLength: number;
    readonly depthwiseWeightByteLength: number;
    readonly affineByteLength: number;
    readonly workgroups: readonly [number, number, number];
    readonly workgroupStorageBytes: number;
}
export interface FusedConformerConvDescriptor extends ConformerConvShape {
    readonly label: string;
    /**
     * Profile-scalar [rows, 2048]. Channels [0,1024) are GLU values
     * and [1024,2048) are GLU gates.
     */
    readonly pointwiseInput: ArenaSlice;
    /** Profile-scalar [9, 1024], contiguous channel-last. */
    readonly depthwiseWeights: GpuTensor;
    /** f32 [1024], gamma / sqrt(runningVariance + epsilon). */
    readonly batchNormScale: GpuTensor;
    /** f32 [1024], beta - runningMean * scale, including any folded conv bias. */
    readonly batchNormShift: GpuTensor;
    /** u32 valid encoder-frame lengths, one per batch item. */
    readonly validLengths: ArenaSlice;
    /** Profile-scalar [rows, 1024]. */
    readonly output: ArenaSlice;
}
export interface ConformerConvDispatchResult {
    readonly output: ArenaSlice;
    readonly rows: number;
    readonly channels: typeof CONFORMER_CONV_CHANNELS;
}
export declare function planFusedConformerConv(shape: ConformerConvShape, executionProfile?: ParakeetExecutionProfile): ConformerConvPlan;
export declare class FusedConformerConvDispatch {
    readonly label: string;
    readonly result: ConformerConvDispatchResult;
    private readonly pipeline;
    private readonly bindGroup;
    private readonly workgroups;
    private destroyed;
    constructor(label: string, result: ConformerConvDispatchResult, pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, workgroups: readonly [number, number, number]);
    encode(encoder: GPUCommandEncoder, timestampWrites?: GPUComputePassTimestampWrites, shape?: EncoderDispatchShape): void;
    destroy(): void;
}
/**
 * Fuses the Conformer convolution module's GLU, same-padded depthwise k9,
 * folded batch normalization, and SiLU.
 *
 * A 128-lane workgroup owns 16 frames by eight vec4 channel groups. It first
 * computes a 24-frame GLU tile (including the four-frame halo on each side)
 * into 3 KiB of f32 workgroup memory. This avoids recomputing sigmoid for every
 * one of the nine overlapping depthwise taps.
 */
export declare class FusedConformerConvKernel {
    private readonly device;
    private readonly arena;
    private readonly pipeline;
    private readonly layout;
    private readonly parameterPool;
    private readonly executionProfile;
    private destroyed;
    private constructor();
    get uniformParameterPoolBytes(): number;
    get uniformParameterPoolUsedSlots(): number;
    static create(device: GPUDevice, arena: GpuActivationArena, uniformParameterCapacity: number, executionProfile?: ParakeetExecutionProfile): Promise<FusedConformerConvKernel>;
    createDispatch(descriptor: FusedConformerConvDescriptor): FusedConformerConvDispatch;
    destroy(): void;
}
export declare function conformerConvWgslForProfile(executionProfile?: ParakeetExecutionProfile): string;
