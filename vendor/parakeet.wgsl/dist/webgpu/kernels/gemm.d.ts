import type { ArenaSlice } from "../arena";
import { GpuActivationArena } from "../arena";
import type { GpuTensor } from "../../model/package";
import { type PaletteExpansionDispatch } from "../../model/palette-expander";
import { RUNTIME_GEMM_TILE_MAJOR_F16_LAYOUT, RUNTIME_GEMM_TILE_MAJOR_F32_LAYOUT, RUNTIME_ROW_MAJOR_F16_LAYOUT, RUNTIME_ROW_MAJOR_F32_LAYOUT } from "../../model/runtime-plan";
import { type ParakeetExecutionProfile } from "../capabilities";
import type { EncoderDispatchShape } from "./execution-shape";
export { RUNTIME_GEMM_TILE_MAJOR_F32_LAYOUT, RUNTIME_ROW_MAJOR_F32_LAYOUT, } from "../../model/runtime-plan";
export declare const F16_SUBGROUP_TILE_COLUMNS = 256;
export declare const F16_SUBGROUP_TILE_INNER = 32;
export declare const F16_SUBGROUP_DIRECT_B_TILE_ROWS = 32;
export declare const F16_SUBGROUP_DIRECT_B_WORKGROUP_SIZE = 128;
export declare const F16_SUBGROUP_STAGED_B_TILE_ROWS = 48;
export declare const F16_SUBGROUP_STAGED_B_WORKGROUP_SIZE = 192;
export declare const TRANSIENT_PALETTE_WEIGHT_SCRATCH_BYTES = 8650752;
export declare const TRANSIENT_PALETTE_PARAMETER_SLOT_COUNT = 11;
export declare const F16_SUBGROUP_STAGED_B_WORKGROUP_BYTES: number;
/** FP16 direct encoder weights favor a deeper contraction tile. */
export declare const PORTABLE_DIRECT_GEMM_GEOMETRY: Readonly<{
    tileRows: 48;
    tileColumns: 128;
    tileInner: 128;
    workgroupSize: 128;
}>;
/** FP16 row-major weights keep their staged contraction tile bounded. */
export declare const PORTABLE_STAGED_GEMM_GEOMETRY: Readonly<{
    tileRows: 48;
    tileColumns: 128;
    tileInner: 32;
    workgroupSize: 128;
}>;
export declare const PORTABLE_FP32_DIRECT_GEMM_GEOMETRY: Readonly<{
    tileRows: 40;
    tileColumns: 128;
    tileInner: 128;
    workgroupSize: 128;
}>;
export declare const PORTABLE_FP32_WIDE_DIRECT_GEMM_GEOMETRY: Readonly<{
    tileRows: 36;
    tileColumns: 128;
    tileInner: 128;
    workgroupSize: 128;
}>;
export declare const PORTABLE_FP32_STAGED_GEMM_GEOMETRY: Readonly<{
    tileRows: 32;
    tileColumns: 128;
    tileInner: 32;
    workgroupSize: 128;
}>;
export declare const F16_PORTABLE_GEMM_WORKGROUP_BYTES = 12288;
export declare const F32_PORTABLE_GEMM_WORKGROUP_BYTES = 20480;
export declare const F16_PORTABLE_BITCAST_LOAD_ENCODING: "bitcast-vec2-u32-to-vec4-f16";
export declare const F16_PORTABLE_UNPACK_LOAD_ENCODING: "unpack2x16float-via-f32";
export declare const F16_PORTABLE_NATIVE_LOAD_ENCODING: "native-vec4-f16-storage";
export type F16PortableLoadEncoding = typeof F16_PORTABLE_BITCAST_LOAD_ENCODING | typeof F16_PORTABLE_UNPACK_LOAD_ENCODING | typeof F16_PORTABLE_NATIVE_LOAD_ENCODING;
export declare function transientPaletteParameterPoolBytes(minUniformBufferOffsetAlignment: number): number;
export type GemmActivation = "none" | "silu" | "relu";
export interface F16SubgroupGemmSpecialization {
    readonly label: string;
    readonly rows: number;
    readonly inner: number;
    readonly columns: number;
    readonly activation: GemmActivation;
    readonly hasBias: boolean;
    readonly residualScale: number | null;
    readonly weightLayout: typeof RUNTIME_GEMM_TILE_MAJOR_F16_LAYOUT | typeof RUNTIME_ROW_MAJOR_F16_LAYOUT;
}
/**
 * Every scalar GEMM instantiated by the fixed B40 encoder graph. The two
 * 1024x1024 residual call sites intentionally share one compiled pipeline.
 */
export declare const F16_SUBGROUP_PRODUCTION_SPECIALIZATIONS: readonly [{
    readonly label: "encoder-layer-ff-expand";
    readonly rows: 7520;
    readonly inner: 1024;
    readonly columns: 4096;
    readonly activation: "silu";
    readonly hasBias: false;
    readonly residualScale: null;
    readonly weightLayout: "n256-k32-tile-major-f16";
}, {
    readonly label: "encoder-layer-ff-contract";
    readonly rows: 7520;
    readonly inner: 4096;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: false;
    readonly residualScale: 0.5;
    readonly weightLayout: "n256-k32-tile-major-f16";
}, {
    readonly label: "encoder-layer-attention-qkv";
    readonly rows: 7520;
    readonly inner: 1024;
    readonly columns: 3072;
    readonly activation: "none";
    readonly hasBias: false;
    readonly residualScale: null;
    readonly weightLayout: "n256-k32-tile-major-f16";
}, {
    readonly label: "encoder-layer-residual-1024";
    readonly rows: 7520;
    readonly inner: 1024;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: false;
    readonly residualScale: 1;
    readonly weightLayout: "n256-k32-tile-major-f16";
}, {
    readonly label: "encoder-layer-adapter-down";
    readonly rows: 7520;
    readonly inner: 1024;
    readonly columns: 256;
    readonly activation: "silu";
    readonly hasBias: false;
    readonly residualScale: null;
    readonly weightLayout: "n256-k32-tile-major-f16";
}, {
    readonly label: "encoder-layer-adapter-up";
    readonly rows: 7520;
    readonly inner: 256;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: false;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f16";
}, {
    readonly label: "encoder-layer-convolution-expand";
    readonly rows: 7520;
    readonly columns: 2048;
    readonly activation: "none";
    readonly hasBias: false;
    readonly residualScale: null;
    readonly weightLayout: "n256-k32-tile-major-f16";
    readonly inner: 1024;
}, {
    readonly label: "encoder-projector";
    readonly rows: 7520;
    readonly inner: 1024;
    readonly columns: 640;
    readonly activation: "none";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f16";
}, {
    readonly label: "subsampling-pointwise3";
    readonly rows: 12032;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f16";
}, {
    readonly label: "subsampling-pointwise3-b2";
    readonly rows: 24064;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f16";
}, {
    readonly label: "subsampling-pointwise3-b3";
    readonly rows: 36096;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f16";
}, {
    readonly label: "subsampling-pointwise6";
    readonly rows: 3008;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f16";
}, {
    readonly label: "subsampling-pointwise6-b2";
    readonly rows: 6016;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f16";
}, {
    readonly label: "subsampling-pointwise6-b3";
    readonly rows: 9024;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f16";
}, {
    readonly label: "subsampling-flatten-project";
    readonly rows: 188;
    readonly inner: 4096;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f16";
}, {
    readonly label: "subsampling-flatten-project-b2";
    readonly rows: 376;
    readonly inner: 4096;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f16";
}, {
    readonly label: "subsampling-flatten-project-b3";
    readonly rows: 564;
    readonly inner: 4096;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f16";
}];
export interface GemmDescriptor {
    readonly label: string;
    readonly a: ArenaSlice;
    readonly b: GpuTensor;
    readonly bPalette?: GpuTensor;
    readonly paletteGroupColumns?: number;
    readonly output: ArenaSlice;
    readonly rows: number;
    readonly inner: number;
    readonly columns: number;
    readonly bias?: GpuTensor;
    readonly residual?: ArenaSlice;
    readonly residualScale?: number;
    readonly activation?: GemmActivation;
    readonly preparedPaletteWeight?: PreparedPaletteWeight;
}
export interface PreparedPaletteWeight {
    readonly source: GpuTensor;
    readonly palette: GpuTensor;
    readonly paletteGroupColumns: number;
    readonly inner: number;
    readonly columns: number;
    readonly runtimeLayout: F16SubgroupGemmSpecialization["weightLayout"];
    readonly binding: GPUBufferBinding;
    readonly preparation: PaletteExpansionDispatch;
}
export declare class GemmDispatch {
    readonly label: string;
    readonly output: ArenaSlice;
    private readonly pipeline;
    private readonly bindGroup;
    private readonly workgroups;
    private readonly rows;
    private readonly inner;
    private readonly columns;
    private readonly weightLayout;
    private readonly kernelBackend;
    private readonly preparation?;
    private destroyed;
    constructor(label: string, output: ArenaSlice, pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, workgroups: readonly [number, number, number], rows: number, inner: number, columns: number, weightLayout: F16SubgroupGemmSpecialization["weightLayout"], kernelBackend: ParakeetExecutionProfile["kernelBackend"], preparation?: PaletteExpansionDispatch | undefined);
    encode(encoder: GPUCommandEncoder, timestampWrites?: GPUComputePassTimestampWrites, shape?: EncoderDispatchShape): void;
    destroy(): void;
}
/**
 * Fixed-shape FP16 GEMM owner. The subgroup profile retains the established
 * direct and staged pipelines; the portable profile selects its separately
 * tuned standards-only pipelines without changing weight preparation.
 */
export declare class F16GemmKernel {
    private readonly device;
    private readonly arena;
    private readonly specializedPipelines;
    private readonly paletteExpander;
    private readonly paletteParameterPool;
    private readonly dequantizedWeightScratch;
    private readonly executionProfile;
    readonly portableLoadEncoding: F16PortableLoadEncoding | null;
    private destroyed;
    private transientPaletteDispatchCountValue;
    private transientPaletteExpandedBytesValue;
    private constructor();
    get transientPaletteParameterBytes(): number;
    get transientPaletteParameterUsedSlots(): number;
    get transientPaletteDispatchCount(): number;
    get transientPaletteExpandedBytes(): number;
    static create(device: GPUDevice, arena: GpuActivationArena, executionProfile?: ParakeetExecutionProfile, diagnosticPortableLoadEncoding?: F16PortableLoadEncoding): Promise<F16GemmKernel>;
    createDispatch(descriptor: GemmDescriptor): GemmDispatch;
    createPreparedPaletteWeight(descriptor: GemmDescriptor, scratchOffset: number): PreparedPaletteWeight;
    private createInlinePaletteWeight;
    private createPaletteWeight;
    private requirePreparedPaletteWeight;
    destroy(): void;
}
export interface F16SubgroupGemmPlan {
    readonly workgroups: readonly [number, number, 1];
}
export interface PortableGemmPlan {
    readonly workgroups: readonly [number, number, 1];
}
type PortableGemmWeightLayout = F16SubgroupGemmSpecialization["weightLayout"] | F32SubgroupGemmSpecialization["weightLayout"];
/**
 * Workgroup-only GEMM used when the adapter has no compatible subgroup
 * surface. Both precisions retain their operation-native package layouts and
 * dispatch inventory.
 */
export declare function planPortableGemm(rows: number, inner: number, columns: number, weightLayout: PortableGemmWeightLayout): PortableGemmPlan;
/**
 * Plan the fixed scalar-subgroup kernel for its operation-native weight
 * layout. Direct dispatches target a fixed B40-capacity shader, while staged
 * geometry bounds-checks its M tail. One pipeline per fixed signature covers
 * every active B1-B40 prefix.
 */
export declare function planF16SubgroupGemm(rows: number, inner: number, columns: number, weightLayout: F16SubgroupGemmSpecialization["weightLayout"]): F16SubgroupGemmPlan;
/**
 * Select the fastest exact portable FP16 storage view for this device's WGSL
 * compiler. Compilers accepting the standard cross-width bitcast use it;
 * a reported source-compilation error selects native vec4<f16> storage.
 * API failures and device failures deliberately surface.
 */
export declare function selectF16PortableLoadEncoding(device: GPUDevice): Promise<F16PortableLoadEncoding>;
/**
 * Emit one fixed-shape N256/K32 f16 scalar-subgroup shader. Direct tile-major
 * weights use M32/WG128; staged row-major weights use M48/WG192. In either
 * geometry every lane owns two vec4 output columns for each of eight rows in
 * its subgroup, preserving the exact f16 contraction sequence.
 */
export declare function f16SubgroupGemmWgsl(specialization: F16SubgroupGemmSpecialization): string;
/**
 * Emit the standards-only FP16 fallback. WG128 uses an M48/N128/K128 tile
 * for direct encoder weights and M48/N128/K32 for staged row-major weights.
 * Operation-native weights and increasing-K accumulator order are preserved.
 */
export declare function f16PortableGemmWgsl(specialization: F16SubgroupGemmSpecialization, loadEncoding?: F16PortableLoadEncoding): string;
export declare const F32_SUBGROUP_TILE_COLUMNS = 128;
export declare const F32_SUBGROUP_TILE_INNER = 32;
export declare const F32_SUBGROUP_DIRECT_B_TILE_ROWS = 32;
export declare const F32_SUBGROUP_DIRECT_B_WORKGROUP_SIZE = 128;
export declare const F32_SUBGROUP_STAGED_B_TILE_ROWS = 48;
export declare const F32_SUBGROUP_STAGED_B_WORKGROUP_SIZE = 192;
export declare const FP32_TRANSIENT_PALETTE_WEIGHT_SCRATCH_BYTES = 17301504;
export declare const F32_SUBGROUP_STAGED_B_WORKGROUP_BYTES: number;
export interface F32SubgroupGemmSpecialization {
    readonly label: string;
    readonly rows: number;
    readonly inner: number;
    readonly columns: number;
    readonly activation: GemmActivation;
    readonly hasBias: boolean;
    readonly residualScale: number | null;
    readonly weightLayout: typeof RUNTIME_GEMM_TILE_MAJOR_F32_LAYOUT | typeof RUNTIME_ROW_MAJOR_F32_LAYOUT;
}
export declare const F32_SUBGROUP_PRODUCTION_SPECIALIZATIONS: readonly [{
    readonly label: "encoder-layer-ff-expand";
    readonly rows: 7520;
    readonly inner: 1024;
    readonly columns: 4096;
    readonly activation: "silu";
    readonly hasBias: false;
    readonly residualScale: null;
    readonly weightLayout: "n128-k32-tile-major-f32";
}, {
    readonly label: "encoder-layer-ff-contract";
    readonly rows: 7520;
    readonly inner: 4096;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: false;
    readonly residualScale: 0.5;
    readonly weightLayout: "n128-k32-tile-major-f32";
}, {
    readonly label: "encoder-layer-attention-qkv";
    readonly rows: 7520;
    readonly inner: 1024;
    readonly columns: 3072;
    readonly activation: "none";
    readonly hasBias: false;
    readonly residualScale: null;
    readonly weightLayout: "n128-k32-tile-major-f32";
}, {
    readonly label: "encoder-layer-residual-1024";
    readonly rows: 7520;
    readonly inner: 1024;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: false;
    readonly residualScale: 1;
    readonly weightLayout: "n128-k32-tile-major-f32";
}, {
    readonly label: "encoder-layer-adapter-down";
    readonly rows: 7520;
    readonly inner: 1024;
    readonly columns: 256;
    readonly activation: "silu";
    readonly hasBias: false;
    readonly residualScale: null;
    readonly weightLayout: "n128-k32-tile-major-f32";
}, {
    readonly label: "encoder-layer-adapter-up";
    readonly rows: 7520;
    readonly inner: 256;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: false;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f32";
}, {
    readonly label: "encoder-layer-convolution-expand";
    readonly rows: 7520;
    readonly inner: 1024;
    readonly columns: 2048;
    readonly activation: "none";
    readonly hasBias: false;
    readonly residualScale: null;
    readonly weightLayout: "n128-k32-tile-major-f32";
}, {
    readonly label: "encoder-projector";
    readonly rows: 7520;
    readonly inner: 1024;
    readonly columns: 640;
    readonly activation: "none";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f32";
}, {
    readonly label: "subsampling-pointwise3";
    readonly rows: 12032;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f32";
}, {
    readonly label: "subsampling-pointwise3-b2";
    readonly rows: 24064;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f32";
}, {
    readonly label: "subsampling-pointwise3-b3";
    readonly rows: 36096;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f32";
}, {
    readonly label: "subsampling-pointwise6";
    readonly rows: 3008;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f32";
}, {
    readonly label: "subsampling-pointwise6-b2";
    readonly rows: 6016;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f32";
}, {
    readonly label: "subsampling-pointwise6-b3";
    readonly rows: 9024;
    readonly inner: 256;
    readonly columns: 256;
    readonly activation: "relu";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f32";
}, {
    readonly label: "subsampling-flatten-project";
    readonly rows: 188;
    readonly inner: 4096;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f32";
}, {
    readonly label: "subsampling-flatten-project-b2";
    readonly rows: 376;
    readonly inner: 4096;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f32";
}, {
    readonly label: "subsampling-flatten-project-b3";
    readonly rows: 564;
    readonly inner: 4096;
    readonly columns: 1024;
    readonly activation: "none";
    readonly hasBias: true;
    readonly residualScale: null;
    readonly weightLayout: "k-by-output-row-major-f32";
}];
export interface F32SubgroupGemmPlan {
    readonly workgroups: readonly [number, number, 1];
}
/**
 * Plan the N128/K32 FP32 scalar subgroup kernel. Both M32 direct-B and M48
 * staged-B kernels bounds-check their row tail, so every active B1-B40 prefix
 * uses the same fixed-shape pipeline.
 */
export declare function planF32SubgroupGemm(rows: number, inner: number, columns: number, weightLayout: F32SubgroupGemmSpecialization["weightLayout"]): F32SubgroupGemmPlan;
/**
 * Emit one fixed-shape N128/K32 FP32 scalar-subgroup shader. Direct
 * tile-major weights use M32/WG128, while row-major common matrices use
 * M48/WG192 and one 16 KiB B tile. Each lane owns one vec4 output for each of
 * eight rows, keeping FP32 accumulator pressure bounded. Direct K1024
 * contractions traverse the operation-native weight tile as one contiguous
 * loop and broadcast one scalar component at a time; K4096 retains its
 * shorter nested K32 loops to avoid the target compiler's long-loop cliff.
 */
export declare function f32SubgroupGemmWgsl(specialization: F32SubgroupGemmSpecialization): string;
/**
 * FP32 counterpart: direct shapes use tuned M36/M40-N128-K128 tiles, while
 * staged row-major shapes use M32/N128/K32 to stay within 20 KiB.
 */
export declare function f32PortableGemmWgsl(specialization: F32SubgroupGemmSpecialization): string;
export interface PreparedFp32PaletteWeight {
    readonly source: GpuTensor;
    readonly palette: GpuTensor;
    readonly paletteGroupColumns: number;
    readonly inner: number;
    readonly columns: number;
    readonly runtimeLayout: F32SubgroupGemmSpecialization["weightLayout"];
    readonly binding: GPUBufferBinding;
    readonly preparation: PaletteExpansionDispatch;
}
export interface Fp32GemmDescriptor extends Omit<GemmDescriptor, "preparedPaletteWeight"> {
    readonly preparedPaletteWeight?: PreparedFp32PaletteWeight;
}
export declare class F32GemmDispatch {
    readonly label: string;
    readonly output: ArenaSlice;
    private readonly pipeline;
    private readonly bindGroup;
    private readonly workgroups;
    private readonly rows;
    private readonly inner;
    private readonly columns;
    private readonly weightLayout;
    private readonly kernelBackend;
    private readonly preparation?;
    private destroyed;
    constructor(label: string, output: ArenaSlice, pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, workgroups: readonly [number, number, number], rows: number, inner: number, columns: number, weightLayout: F32SubgroupGemmSpecialization["weightLayout"], kernelBackend: ParakeetExecutionProfile["kernelBackend"], preparation?: PaletteExpansionDispatch | undefined);
    encode(encoder: GPUCommandEncoder, timestampWrites?: GPUComputePassTimestampWrites, shape?: EncoderDispatchShape): void;
    destroy(): void;
}
/**
 * Fixed-shape FP32 GEMM owner. Both backends reuse the same palette expansion
 * and graph-local 17,301,504-byte scratch; only their compiled GEMM pipelines
 * and dispatch geometry differ.
 */
export declare class F32GemmKernel {
    private readonly device;
    private readonly arena;
    private readonly specializedPipelines;
    private readonly paletteExpander;
    private readonly paletteParameterPool;
    private readonly dequantizedWeightScratch;
    private readonly executionProfile;
    private destroyed;
    private transientPaletteDispatchCountValue;
    private transientPaletteExpandedBytesValue;
    private constructor();
    get transientPaletteParameterBytes(): number;
    get transientPaletteParameterUsedSlots(): number;
    get transientPaletteDispatchCount(): number;
    get transientPaletteExpandedBytes(): number;
    static create(device: GPUDevice, arena: GpuActivationArena, executionProfile?: ParakeetExecutionProfile): Promise<F32GemmKernel>;
    createDispatch(descriptor: Fp32GemmDescriptor): F32GemmDispatch;
    createPreparedPaletteWeight(descriptor: Fp32GemmDescriptor, scratchOffset: number): PreparedFp32PaletteWeight;
    private createInlinePaletteWeight;
    private createPaletteWeight;
    private requirePreparedPaletteWeight;
    destroy(): void;
}
