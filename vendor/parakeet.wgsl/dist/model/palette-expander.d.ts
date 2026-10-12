import { PALETTE_EXPANSION_PARAMETER_BYTES, RUNTIME_GEMM_TILE_MAJOR_F16_LAYOUT, RUNTIME_GEMM_TILE_MAJOR_F32_LAYOUT, RUNTIME_ROW_MAJOR_F16_LAYOUT, RUNTIME_ROW_MAJOR_F32_LAYOUT } from "./runtime-plan";
import { type ParakeetExecutionProfile } from "../webgpu/capabilities";
export { PALETTE_EXPANSION_PARAMETER_BYTES };
type F16PaletteRuntimeLayout = typeof RUNTIME_ROW_MAJOR_F16_LAYOUT | typeof RUNTIME_GEMM_TILE_MAJOR_F16_LAYOUT;
type F32PaletteRuntimeLayout = typeof RUNTIME_ROW_MAJOR_F32_LAYOUT | typeof RUNTIME_GEMM_TILE_MAJOR_F32_LAYOUT;
type PaletteRuntimeLayout = F16PaletteRuntimeLayout | F32PaletteRuntimeLayout;
export interface PaletteExpansionDispatch {
    readonly label: string;
    encode(encoder: GPUCommandEncoder): void;
    destroy(): void;
}
export interface TransientPaletteExpansionDescriptor {
    readonly label: string;
    readonly source: GPUBufferBinding;
    readonly palette: GPUBufferBinding;
    readonly target: GPUBufferBinding;
    readonly scalarCount: number;
    readonly columns: number;
    readonly paletteBits: 5 | 6;
    readonly paletteGroupColumns: number;
    readonly paletteGroups: number;
    readonly runtimeLayout: PaletteRuntimeLayout;
}
export declare function paletteExpansionParameterPoolBytes(slotCount: number, minUniformBufferOffsetAlignment: number): number;
export declare class PaletteExpansionParameterPool {
    private readonly device;
    readonly slotCapacity: number;
    private readonly executionProfile;
    readonly byteLength: number;
    readonly slotStride: number;
    private readonly buffer;
    private readonly bindings;
    private destroyed;
    constructor(device: GPUDevice, slotCapacity: number, label: string, executionProfile?: ParakeetExecutionProfile);
    get usedSlots(): number;
    bindingFor(descriptor: TransientPaletteExpansionDescriptor): GPUBufferBinding;
    destroy(): void;
}
export declare class PaletteWeightExpander {
    private readonly device;
    private readonly layout;
    private readonly pipelines;
    readonly executionProfile: ParakeetExecutionProfile;
    private constructor();
    static create(device: GPUDevice, executionProfile?: ParakeetExecutionProfile): Promise<PaletteWeightExpander>;
    createPooledDispatch(descriptor: TransientPaletteExpansionDescriptor, parameters: GPUBufferBinding): PaletteExpansionDispatch;
    private createBoundDispatch;
}
export declare function paletteDequantWgsl(bits: 5 | 6, runtimeLayout: F16PaletteRuntimeLayout): string;
export declare function paletteDequantFp32Wgsl(bits: 5 | 6, runtimeLayout: F32PaletteRuntimeLayout): string;
