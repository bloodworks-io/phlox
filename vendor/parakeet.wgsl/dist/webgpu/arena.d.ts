export interface ArenaSlice {
    readonly label: string;
    /**
     * Physical arena-buffer index. The established FP16 arena omits this field
     * and therefore remains buffer zero; the FP32 plan uses explicit indices to
     * keep every allocation below stock WebGPU binding limits.
     */
    readonly bufferIndex?: number;
    readonly byteOffset: number;
    readonly byteLength: number;
}
export interface ActivationArenaBufferPlan {
    readonly label: string;
    readonly byteLength: number;
}
/**
 * A fixed set of GPU activation allocations. The FP16 graph continues to use
 * exactly one buffer. The FP32 graph partitions the same lifetime-aliased
 * plan across a small fixed set of buffers so no individual allocation needs
 * an unusually large WebGPU storage-buffer limit.
 */
export declare class GpuActivationArena {
    readonly buffers: readonly GPUBuffer[];
    readonly bufferByteLengths: readonly number[];
    readonly byteLength: number;
    private destroyed;
    constructor(device: GPUDevice, byteLengthOrBuffers: number | readonly ActivationArenaBufferPlan[], label?: string);
    get bufferCount(): number;
    get largestBufferByteLength(): number;
    slice(label: string, byteOffset: number, byteLength: number, bufferIndex?: number): ArenaSlice;
    binding(slice: ArenaSlice): GPUBufferBinding;
    bufferFor(slice: ArenaSlice): GPUBuffer;
    bufferByteLengthFor(slice: ArenaSlice): number;
    upload(device: GPUDevice, destination: ArenaSlice, data: ArrayBuffer | ArrayBufferView<ArrayBuffer>): void;
    destroy(): void;
    private assertAlive;
}
export declare class LinearArenaPlanner {
    private cursor;
    allocate(label: string, byteLength: number): ArenaSlice;
    get byteLength(): number;
}
export declare function align(value: number, alignment: number): number;
