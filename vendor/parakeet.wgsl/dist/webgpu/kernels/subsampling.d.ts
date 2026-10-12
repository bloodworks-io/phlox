import type { GpuTensor } from "../../model/package";
import type { ArenaSlice } from "../arena";
import { GpuActivationArena } from "../arena";
import { type ParakeetExecutionProfile } from "../capabilities";
export declare const SUBSAMPLING_DEPTHWISE_PARAMETER_BYTES = 48;
export declare const SUBSAMPLING_FUSED_PARAMETER_BYTES = 16;
declare const FUSED_CONV0_HEIGHT = 751;
declare const FUSED_CONV0_WIDTH = 64;
declare const FUSED_WORKGROUP_STORAGE_BYTES: number;
export declare const SUBSAMPLING_MASK_PARAMETER_BYTES = 32;
/** Conv0 weights are transposed from [out, 1, kh, kw] to this packed order. */
export declare const SUBSAMPLING_CONV0_WEIGHT_LAYOUT = "kh-kw-output-channel-vec4";
/** Depthwise weights are transposed from [channel, 1, kh, kw]. */
export declare const SUBSAMPLING_DEPTHWISE_WEIGHT_LAYOUT = "kh-kw-channel-vec4";
export declare const SUBSAMPLING_BIAS_LAYOUT = "output-channel";
export interface SubsamplingShape {
    readonly batchSize: number;
    /** Time-like spatial dimension. */
    readonly inputHeight: number;
    /** Mel/frequency-like spatial dimension. */
    readonly inputWidth: number;
    readonly channels: number;
}
interface SubsamplingValidLengthDescriptor {
    /** Raw feature-frame lengths for the full encoder batch. */
    readonly validLengths: ArenaSlice;
    /** First sequence in the current subsampling microbatch. */
    readonly validLengthBatchOffset: number;
    /** Number of same-padded stride-2 convolutions through this output. */
    readonly validLengthSubsamplingSteps: number;
}
export interface SubsamplingPlan extends SubsamplingShape {
    readonly outputHeight: number;
    readonly outputWidth: number;
    readonly channelVectors: number;
    readonly inputByteLength: number;
    readonly outputByteLength: number;
    readonly weightByteLength: number;
    readonly biasByteLength: number;
    readonly workgroups: readonly [number, number, number];
}
export interface DepthwiseSubsamplingDescriptor extends SubsamplingShape, SubsamplingValidLengthDescriptor {
    readonly label: string;
    /** Profile-scalar [batch, inputHeight, inputWidth, channels]. */
    readonly input: ArenaSlice;
    /** Profile-scalar [3, 3, channels], contiguous channel-last. */
    readonly weights: GpuTensor;
    /** f32 [channels]. */
    readonly bias: GpuTensor;
    /** Profile-scalar [batch, outputHeight, outputWidth, channels]. */
    readonly output: ArenaSlice;
}
export interface FusedSubsamplingConv0Depthwise2Descriptor extends SubsamplingShape {
    readonly label: string;
    /** Feature-major f32 `[batch, 128, 1501]`. */
    readonly input: ArenaSlice;
    readonly conv0Weights: GpuTensor;
    readonly conv0Bias: GpuTensor;
    readonly depthwiseWeights: GpuTensor;
    readonly depthwiseBias: GpuTensor;
    /** Channel-last profile-scalar `[batch, 376, 32, 256]`. */
    readonly output: ArenaSlice;
    readonly validLengths: ArenaSlice;
    readonly validLengthBatchOffset: number;
}
export interface FusedSubsamplingPlan extends SubsamplingPlan {
    readonly conv0Height: typeof FUSED_CONV0_HEIGHT;
    readonly conv0Width: typeof FUSED_CONV0_WIDTH;
    readonly workgroupStorageBytes: typeof FUSED_WORKGROUP_STORAGE_BYTES;
}
export declare function subsamplingOutputDimension(input: number): number;
export declare function subsamplingValidLength(featureLength: number, steps: number): number;
export declare function planDepthwiseSubsampling(shape: SubsamplingShape, executionProfile?: ParakeetExecutionProfile): SubsamplingPlan;
export declare function planFusedSubsamplingConv0Depthwise2(shape: SubsamplingShape, executionProfile?: ParakeetExecutionProfile): FusedSubsamplingPlan;
export declare class SubsamplingDispatch {
    readonly label: string;
    readonly output: ArenaSlice;
    readonly outputHeight: number;
    readonly outputWidth: number;
    private readonly pipeline;
    private readonly bindGroup;
    private readonly workgroups;
    private destroyed;
    constructor(label: string, output: ArenaSlice, outputHeight: number, outputWidth: number, pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, workgroups: readonly [number, number, number]);
    encode(encoder: GPUCommandEncoder, timestampWrites?: GPUComputePassTimestampWrites): void;
    destroy(): void;
}
/**
 * Fixed-shape conv0 + depthwise2 subsampling for one active microbatch.
 *
 * The FP16 profile rounds a 5x17x16 conv0 tile through f16 workgroup storage
 * before the depthwise accumulation. The FP32 profile keeps a 5x17x8 tile in
 * f32. Both avoid materializing the 751x64x256 activation in global memory.
 */
export declare class FusedSubsamplingConv0Depthwise2Kernel {
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
    static create(device: GPUDevice, arena: GpuActivationArena, uniformParameterCapacity: number, executionProfile?: ParakeetExecutionProfile): Promise<FusedSubsamplingConv0Depthwise2Kernel>;
    createDispatch(descriptor: FusedSubsamplingConv0Depthwise2Descriptor): SubsamplingDispatch;
    destroy(): void;
}
/**
 * Channel-last 3x3 stride-2 depthwise subsampling convolution.
 *
 * This stage deliberately performs no activation: the following packed
 * pointwise projection/activation remains a separate graph operation.
 */
export declare class DepthwiseSubsamplingKernel {
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
    static create(device: GPUDevice, arena: GpuActivationArena, uniformParameterCapacity: number, executionProfile?: ParakeetExecutionProfile): Promise<DepthwiseSubsamplingKernel>;
    createDispatch(descriptor: DepthwiseSubsamplingDescriptor): SubsamplingDispatch;
    destroy(): void;
}
export interface SubsamplingTimeMaskDescriptor {
    readonly label: string;
    /** In-place profile-scalar `[batch, height, width, channels]`. */
    readonly values: ArenaSlice;
    /** Raw feature-frame lengths for the full encoder batch. */
    readonly validLengths: ArenaSlice;
    readonly batchSize: number;
    readonly height: number;
    readonly width: number;
    readonly channels: number;
    readonly validLengthBatchOffset: number;
    readonly validLengthSubsamplingSteps: number;
}
export declare class SubsamplingTimeMaskDispatch {
    readonly label: string;
    private readonly pipeline;
    private readonly bindGroup;
    private readonly workgroups;
    private destroyed;
    constructor(label: string, pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, workgroups: readonly [number, number, number]);
    encode(encoder: GPUCommandEncoder, timestampWrites?: GPUComputePassTimestampWrites): void;
    destroy(): void;
}
/** Restores the model's time mask after a bias-bearing pointwise Conv2d. */
export declare class SubsamplingTimeMaskKernel {
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
    static create(device: GPUDevice, arena: GpuActivationArena, uniformParameterCapacity: number, executionProfile?: ParakeetExecutionProfile): Promise<SubsamplingTimeMaskKernel>;
    createDispatch(descriptor: SubsamplingTimeMaskDescriptor): SubsamplingTimeMaskDispatch;
    destroy(): void;
}
export declare function fusedSubsamplingWorkgroupStorageBytes(executionProfile?: ParakeetExecutionProfile): number;
export declare function fusedSubsamplingWgslForProfile(executionProfile?: ParakeetExecutionProfile): string;
export declare function depthwiseSubsamplingWgslForProfile(executionProfile?: ParakeetExecutionProfile): string;
export declare function subsamplingTimeMaskWgslForProfile(executionProfile?: ParakeetExecutionProfile): string;
export {};
