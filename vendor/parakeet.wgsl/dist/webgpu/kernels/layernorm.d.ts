import type { GpuTensor } from "../../model/package";
import type { ArenaSlice } from "../arena";
import { GpuActivationArena } from "../arena";
import { type ParakeetExecutionProfile } from "../capabilities";
import type { EncoderDispatchShape } from "./execution-shape";
export declare const LAYERNORM_PARAMETER_BYTES = 16;
export interface LayerNormDescriptor {
    readonly label: string;
    readonly input: ArenaSlice;
    readonly output: ArenaSlice;
    readonly gamma: GpuTensor;
    readonly beta: GpuTensor;
    readonly rows: number;
    readonly channels: number;
    readonly epsilon?: number;
}
export declare class LayerNormDispatch {
    readonly label: string;
    readonly output: ArenaSlice;
    private readonly pipeline;
    private readonly bindGroup;
    private readonly rows;
    private destroyed;
    constructor(label: string, output: ArenaSlice, pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, rows: number);
    encode(encoder: GPUCommandEncoder, timestampWrites?: GPUComputePassTimestampWrites, shape?: EncoderDispatchShape): void;
    destroy(): void;
}
export declare class LayerNormKernel {
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
    static create(device: GPUDevice, arena: GpuActivationArena, uniformParameterCapacity: number, executionProfile?: ParakeetExecutionProfile): Promise<LayerNormKernel>;
    createDispatch(descriptor: LayerNormDescriptor): LayerNormDispatch;
    destroy(): void;
}
export declare function layerNormWgslForProfile(executionProfile?: ParakeetExecutionProfile): string;
