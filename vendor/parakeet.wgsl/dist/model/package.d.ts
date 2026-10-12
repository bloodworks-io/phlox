import { type ParakeetFileRecord, type ParakeetManifest, type ParakeetModelPrecision, type ParakeetTensorRecord } from "./manifest";
import { type RuntimeBufferId, type RuntimePackageMemoryPlan, type RuntimePackagePlan, type RuntimeShardPlan, type RuntimeTensorRecord } from "./runtime-plan";
interface PackageLoadProgress {
    readonly phase: "manifest" | "weights" | "tokenizer" | "ready";
    readonly file?: string;
    readonly loadedBytes: number;
    readonly totalBytes: number;
}
interface ParakeetPackageLoadOptions {
    readonly fetch?: typeof fetch;
    readonly signal?: AbortSignal;
    readonly onProgress?: (progress: PackageLoadProgress) => void;
    /** Register the selected package inventory before any child asset fetch. */
    readonly onManifest?: (manifest: ParakeetManifest) => void | Promise<void>;
    /**
     * Capability-selected precision. This pins both the manifest precision and
     * the exact generated manifest digest before any model shard is requested.
     */
    readonly expectedPrecision: ParakeetModelPrecision;
}
export interface GpuTensor {
    readonly sourceRecord: ParakeetTensorRecord;
    readonly runtimeRecord: RuntimeTensorRecord;
    readonly buffer: GPUBuffer;
    readonly binding: GPUBufferBinding;
}
export declare class ParakeetGpuPackage {
    private readonly buffers;
    readonly memory: RuntimePackageMemoryPlan;
    readonly precision: ParakeetModelPrecision;
    readonly manifestUrl: string;
    readonly manifestSha256: string;
    readonly manifestListedBytes: number;
    private manifestValue;
    private tokenizerValue;
    private tensorPlans;
    private destroyed;
    private constructor();
    get manifest(): ParakeetManifest;
    get tokenizer(): unknown;
    static load(device: GPUDevice, manifestUrl: string, options: ParakeetPackageLoadOptions): Promise<ParakeetGpuPackage>;
    tensor(name: string): GpuTensor;
    releaseInitializationMetadata(): void;
    destroy(): void;
}
interface LoadedRuntimeAssets {
    readonly buffers: Map<RuntimeBufferId, GPUBuffer>;
    readonly tokenizer: unknown;
}
declare function loadRuntimeAssets(device: GPUDevice, manifestUrl: string, manifest: ParakeetManifest, plan: RuntimePackagePlan, fetchAsset: typeof fetch, fetchInit: RequestInit | undefined, options: Pick<ParakeetPackageLoadOptions, "signal" | "onProgress">): Promise<LoadedRuntimeAssets>;
declare function loadRuntimeShard(device: GPUDevice, response: Response, shard: Extract<RuntimeShardPlan, {
    readonly hashOnly: false;
}>, signal: AbortSignal | undefined, onProgress?: (loadedBytes: number) => void): Promise<GPUBuffer>;
declare function streamAndValidateShard(device: GPUDevice, response: Response, file: ParakeetFileRecord, target: GPUBuffer | undefined, signal: AbortSignal | undefined, onProgress?: (loadedBytes: number) => void): Promise<void>;
/**
 * Narrow test seam for the production loader's streaming and cleanup
 * invariants. The public package path always constructs the fixed plan above.
 */
export declare const __packageLoaderInternals: Readonly<{
    loadRuntimeAssets: typeof loadRuntimeAssets;
    loadRuntimeShard: typeof loadRuntimeShard;
    streamAndValidateShard: typeof streamAndValidateShard;
}>;
export {};
