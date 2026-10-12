import type { GpuTensor } from "../../model/package";
import type { ArenaSlice } from "../arena";
import { GpuActivationArena } from "../arena";
import { type ParakeetExecutionProfile } from "../capabilities";
import type { EncoderDispatchShape } from "./execution-shape";
export declare const RELATIVE_ATTENTION_PARAMETER_BYTES = 32;
export interface RelativeAttentionDescriptor {
    readonly label: string;
    readonly qkv: ArenaSlice;
    readonly projectedPositions: GpuTensor;
    readonly biasU: GpuTensor;
    readonly biasV: GpuTensor;
    readonly validLengths: ArenaSlice;
    readonly output: ArenaSlice;
    readonly batchSize: number;
    readonly frames: number;
}
export declare class RelativeAttentionDispatch {
    readonly label: string;
    readonly output: ArenaSlice;
    private readonly pipeline;
    private readonly bindGroup;
    private readonly workgroups;
    private destroyed;
    constructor(label: string, output: ArenaSlice, pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, workgroups: readonly [number, number, number]);
    encode(encoder: GPUCommandEncoder, timestampWrites?: GPUComputePassTimestampWrites, shape?: EncoderDispatchShape): void;
    destroy(): void;
}
/**
 * Fused full relative-position attention. It never materializes an O(T²)
 * score tensor: one workgroup owns six adjacent queries for one
 * (batch, head), reuses each K vector across those queries, computes FP32
 * softmax, then reuses 16-key V tiles across their context reductions.
 */
export declare class RelativeAttentionKernel {
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
    static create(device: GPUDevice, arena: GpuActivationArena, uniformParameterCapacity: number, executionProfile?: ParakeetExecutionProfile): Promise<RelativeAttentionKernel>;
    createDispatch(descriptor: RelativeAttentionDescriptor): RelativeAttentionDispatch;
    destroy(): void;
}
export declare function relativeAttentionWgslForProfile(executionProfile?: ParakeetExecutionProfile): string;
export declare function relativeAttentionWorkgroupStorageBytes(executionProfile?: ParakeetExecutionProfile): number;
