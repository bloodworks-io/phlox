export interface UniformParameterPoolPlan {
    readonly parameterBytes: number;
    readonly slotCapacity: number;
    readonly slotStride: number;
    readonly byteLength: number;
}
export declare function planUniformParameterPool(parameterBytes: number, slotCapacity: number, minUniformBufferOffsetAlignment: number): UniformParameterPoolPlan;
export declare class UniformParameterPool {
    private readonly device;
    readonly parameterBytes: number;
    readonly slotCapacity: number;
    readonly byteLength: number;
    readonly slotStride: number;
    private readonly buffer;
    private readonly bindings;
    private destroyed;
    constructor(device: GPUDevice, parameterBytes: number, slotCapacity: number, label: string);
    get usedSlots(): number;
    bindingFor(label: string, data: ArrayBuffer | ArrayBufferView<ArrayBuffer>): GPUBufferBinding;
    destroy(): void;
}
