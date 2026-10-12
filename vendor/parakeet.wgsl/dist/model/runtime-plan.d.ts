import type { ParakeetFileRecord, ParakeetManifest, ParakeetTensorRecord } from "./manifest";
export declare const RUNTIME_STORAGE_ALIGNMENT = 256;
export declare const RUNTIME_BUFFER_LIMIT_BYTES: number;
export declare const ENCODER_LAYER_COUNT = 24;
export declare const ENCODER_LAYER_PALETTE_MATRICES = 10;
export declare const COMMON_TRANSIENT_PALETTE_MATRIX_COUNT = 4;
export declare const FP16_PACKED_DOWNLOAD_BYTES = 413137152;
export declare const FP16_RETAINED_RUNTIME_BYTES = 413003776;
export declare const FP16_EXPANDED_RUNTIME_BYTES = 0;
export declare const FP16_RUNTIME_GPU_BYTES: number;
export declare const FP16_LARGEST_RUNTIME_SHARD_BYTES = 16999168;
export declare const FP32_PACKED_DOWNLOAD_BYTES = 440517632;
export declare const FP32_RETAINED_RUNTIME_BYTES = 440384256;
export declare const FP32_EXPANDED_RUNTIME_BYTES = 0;
export declare const FP32_RUNTIME_GPU_BYTES: number;
export declare const FP32_LARGEST_RUNTIME_SHARD_BYTES = 33558528;
export declare const RUNTIME_ROW_MAJOR_F16_LAYOUT = "k-by-output-row-major-f16";
export declare const RUNTIME_GEMM_TILE_MAJOR_F16_LAYOUT = "n256-k32-tile-major-f16";
export declare const RUNTIME_ROW_MAJOR_F32_LAYOUT = "k-by-output-row-major-f32";
export declare const RUNTIME_GEMM_TILE_MAJOR_F32_LAYOUT = "n128-k32-tile-major-f32";
export declare const RUNTIME_GEMM_TILE_COLUMNS = 256;
export declare const RUNTIME_GEMM_F32_TILE_COLUMNS = 128;
export declare const RUNTIME_GEMM_TILE_INNER = 32;
export declare const PALETTE_EXPANSION_PARAMETER_BYTES = 16;
export type RuntimeBufferId = `source-shard-${string}`;
export interface RuntimeTensorRecord {
    readonly bufferId: RuntimeBufferId;
    readonly byteOffset: number;
    readonly byteLength: number;
    readonly dtype: ParakeetTensorRecord["dtype"];
    readonly logicalShape: readonly number[];
    readonly storageShape: readonly number[];
    readonly layout: string;
}
export interface RuntimeTensorPlan {
    readonly name: string;
    readonly sourceRecord: ParakeetTensorRecord;
    readonly runtimeRecord: RuntimeTensorRecord;
}
export interface RuntimeBufferPlan {
    readonly id: RuntimeBufferId;
    readonly label: string;
    readonly byteLength: number;
    readonly tensorCount: number;
}
export type RuntimeShardPlan = {
    readonly file: ParakeetFileRecord;
    readonly hashOnly: true;
} | {
    readonly file: ParakeetFileRecord;
    readonly hashOnly: false;
    readonly runtimeBufferId: RuntimeBufferId;
};
export interface RuntimePackageMemoryPlan {
    readonly packedDownloadBytes: number;
    readonly retainedRuntimeBytes: number;
    readonly expandedRuntimeBytes: number;
    readonly runtimeGpuBytes: number;
    readonly largestRuntimeShardBytes: number;
    readonly loaderPeakGpuBytes: number;
    readonly runtimeBufferCount: number;
}
export interface RuntimePackagePlan {
    readonly buffers: readonly RuntimeBufferPlan[];
    readonly tensors: ReadonlyMap<string, RuntimeTensorPlan>;
    readonly shards: readonly RuntimeShardPlan[];
    readonly memory: RuntimePackageMemoryPlan;
}
export declare function planRuntimePackage(manifest: ParakeetManifest): RuntimePackagePlan;
export declare function paletteBitsForLayout(layout: string): 5 | 6 | undefined;
export declare function alignRuntimeOffset(value: number): number;
export declare function runtimeGemmTileMajorStorageShape(inner: number, columns: number): readonly [number, number, number, number];
export declare function runtimeGemmTileMajorF32StorageShape(inner: number, columns: number): readonly [number, number, number, number];
export declare function runtimeGemmTileMajorScalarIndex(scalarIndex: number, inner: number, columns: number): number;
export declare function runtimeGemmTileMajorF32ScalarIndex(scalarIndex: number, inner: number, columns: number): number;
