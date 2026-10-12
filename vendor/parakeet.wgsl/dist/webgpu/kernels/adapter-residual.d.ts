import type { ArenaSlice } from "../arena";
import { GpuActivationArena } from "../arena";
import type { EncoderDispatchShape } from "./execution-shape";
export interface AdapterResidualDescriptor {
    readonly label: string;
    readonly source: ArenaSlice;
    readonly accumulator: ArenaSlice;
    readonly rows: number;
    readonly channels: number;
}
export declare class AdapterResidualDispatch {
    readonly label: string;
    private readonly pipeline;
    private readonly bindGroup;
    private readonly rows;
    private destroyed;
    constructor(label: string, pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, rows: number);
    encode(encoder: GPUCommandEncoder, timestampWrites?: GPUComputePassTimestampWrites, shape?: EncoderDispatchShape): void;
    destroy(): void;
}
export declare class AdapterResidualKernel {
    private readonly device;
    private readonly arena;
    private readonly pipeline;
    private readonly layout;
    private readonly channels;
    private destroyed;
    private constructor();
    static create(device: GPUDevice, arena: GpuActivationArena, channels: number, enableF16: boolean): Promise<AdapterResidualKernel>;
    createDispatch(descriptor: AdapterResidualDescriptor): AdapterResidualDispatch;
    destroy(): void;
}
