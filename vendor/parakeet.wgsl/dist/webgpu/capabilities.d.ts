/**
 * WebGPU capability negotiation for the stock-browser Parakeet runtime.
 *
 * Parakeet selects its execution profile from the stock features exposed by
 * the adapter. Precision depends only on shader-f16. Kernel selection is an
 * independent capability choice: a fixed 32-lane subgroup keeps the
 * established fast path, while every other adapter uses standards-only
 * portable kernels. No experimental browser feature is requested.
 */
export declare const PARAKEET_FP16_REQUIRED_WEBGPU_FEATURES: readonly ["shader-f16", "subgroups"];
export declare const PARAKEET_FP32_REQUIRED_WEBGPU_FEATURES: readonly ["subgroups"];
export declare const PARAKEET_FP16_PORTABLE_REQUIRED_WEBGPU_FEATURES: readonly ["shader-f16"];
export declare const PARAKEET_FP32_PORTABLE_REQUIRED_WEBGPU_FEATURES: readonly [];
export declare const PARAKEET_REQUIRED_SUBGROUP_SIZE = 32;
export declare const PARAKEET_OPTIONAL_WEBGPU_FEATURES: readonly ["timestamp-query"];
export declare const PARAKEET_STOCK_WEBGPU_FEATURES: readonly ["shader-f16", "subgroups", "timestamp-query"];
export type ParakeetRequiredWebGpuFeature = (typeof PARAKEET_FP16_REQUIRED_WEBGPU_FEATURES)[number] | (typeof PARAKEET_FP32_REQUIRED_WEBGPU_FEATURES)[number] | (typeof PARAKEET_FP16_PORTABLE_REQUIRED_WEBGPU_FEATURES)[number] | (typeof PARAKEET_FP32_PORTABLE_REQUIRED_WEBGPU_FEATURES)[number];
export type ParakeetOptionalWebGpuFeature = (typeof PARAKEET_OPTIONAL_WEBGPU_FEATURES)[number];
export type ParakeetStockWebGpuFeature = (typeof PARAKEET_STOCK_WEBGPU_FEATURES)[number];
export interface ParakeetFp16ExecutionProfile {
    readonly precision: "fp16";
    readonly kernelBackend: "subgroups" | "portable";
    readonly requiredFeatures: typeof PARAKEET_FP16_REQUIRED_WEBGPU_FEATURES | typeof PARAKEET_FP16_PORTABLE_REQUIRED_WEBGPU_FEATURES;
}
export interface ParakeetFp32ExecutionProfile {
    readonly precision: "fp32";
    readonly kernelBackend: "subgroups" | "portable";
    readonly requiredFeatures: typeof PARAKEET_FP32_REQUIRED_WEBGPU_FEATURES | typeof PARAKEET_FP32_PORTABLE_REQUIRED_WEBGPU_FEATURES;
}
export type ParakeetExecutionProfile = ParakeetFp16ExecutionProfile | ParakeetFp32ExecutionProfile;
export declare const PARAKEET_FP16_EXECUTION_PROFILE: ParakeetFp16ExecutionProfile;
export declare const PARAKEET_FP32_EXECUTION_PROFILE: ParakeetFp32ExecutionProfile;
export declare const PARAKEET_FP16_PORTABLE_EXECUTION_PROFILE: ParakeetFp16ExecutionProfile;
export declare const PARAKEET_FP32_PORTABLE_EXECUTION_PROFILE: ParakeetFp32ExecutionProfile;
/**
 * Limits that directly constrain Parakeet's weight shards, activation arena,
 * bind-group layout, and compute kernels.
 */
export declare const PARAKEET_WEBGPU_LIMIT_NAMES: readonly ["maxBufferSize", "maxStorageBufferBindingSize", "maxUniformBufferBindingSize", "maxBindGroups", "maxBindingsPerBindGroup", "maxStorageBuffersPerShaderStage", "maxUniformBuffersPerShaderStage", "maxDynamicStorageBuffersPerPipelineLayout", "maxDynamicUniformBuffersPerPipelineLayout", "maxComputeWorkgroupStorageSize", "maxComputeInvocationsPerWorkgroup", "maxComputeWorkgroupSizeX", "maxComputeWorkgroupSizeY", "maxComputeWorkgroupSizeZ", "maxComputeWorkgroupsPerDimension", "minStorageBufferOffsetAlignment", "minUniformBufferOffsetAlignment"];
export type ParakeetWebGpuLimitName = (typeof PARAKEET_WEBGPU_LIMIT_NAMES)[number];
export type ParakeetWebGpuLimits = Readonly<Record<ParakeetWebGpuLimitName, number>>;
export interface WebGpuAdapterInfoSnapshot {
    readonly vendor: string;
    readonly architecture: string;
    readonly device: string;
    readonly description: string;
    readonly subgroupMinSize?: number;
    readonly subgroupMaxSize?: number;
    readonly isFallbackAdapter?: boolean;
}
export interface WebGpuStockFeatureStatus {
    readonly adapterSupported: boolean;
    readonly deviceEnabled: boolean;
    readonly required: boolean;
    readonly requested: boolean;
}
export type WebGpuStockFeatureReport = Readonly<Record<ParakeetStockWebGpuFeature, WebGpuStockFeatureStatus>>;
export interface WebGpuCapabilityReport {
    readonly executionProfile: ParakeetExecutionProfile;
    readonly adapterInfo: WebGpuAdapterInfoSnapshot;
    readonly adapterFeatures: readonly string[];
    readonly deviceFeatures: readonly string[];
    readonly stockFeatures: WebGpuStockFeatureReport;
    readonly requiredFeatures: readonly ParakeetRequiredWebGpuFeature[];
    readonly requestedOptionalFeatures: readonly ParakeetOptionalWebGpuFeature[];
    readonly adapterLimits: ParakeetWebGpuLimits;
    readonly deviceLimits: ParakeetWebGpuLimits;
    readonly requestedLimits: Readonly<Partial<Record<ParakeetWebGpuLimitName, number>>>;
}
export interface WebGpuContext {
    readonly adapter: GPUAdapter;
    readonly device: GPUDevice;
    readonly executionProfile: ParakeetExecutionProfile;
    readonly report: WebGpuCapabilityReport;
}
export interface RequestWebGpuContextOptions {
    /**
     * Optional features to negotiate. Unsupported entries are omitted rather
     * than making device creation fail.
     */
    readonly optionalFeatures?: readonly ParakeetOptionalWebGpuFeature[];
    /**
     * Limits the runtime actually needs. Requesting only known requirements is
     * preferable to requesting every adapter maximum.
     */
    readonly requiredLimits?: Readonly<Partial<Record<ParakeetWebGpuLimitName, number>>>;
    /** Primarily useful for deterministic tests or an embedded browser host. */
    readonly gpu?: GPU;
}
export interface WebGpuLimitDeficit {
    readonly name: ParakeetWebGpuLimitName;
    readonly requested: number;
    readonly available: number;
    readonly relation: "at-least" | "at-most";
}
export type WebGpuUnavailableCode = "INSECURE_CONTEXT" | "WEBGPU_UNAVAILABLE" | "ADAPTER_UNAVAILABLE" | "FEATURE_UNAVAILABLE" | "LIMIT_UNAVAILABLE";
export declare class WebGpuUnavailableError extends Error {
    readonly code: WebGpuUnavailableCode;
    readonly deficits: readonly WebGpuLimitDeficit[];
    constructor(code: WebGpuUnavailableCode, message: string, deficits?: readonly WebGpuLimitDeficit[]);
}
export declare function negotiateOptionalWebGpuFeatures(availableFeatures: Iterable<string>, requestedFeatures?: readonly ParakeetOptionalWebGpuFeature[]): ParakeetOptionalWebGpuFeature[];
/**
 * Prefer FP16 whenever shader-f16 is available. Independently retain the
 * established subgroup implementation only for its fixed 32-lane contract.
 * A subgroup feature without both reported bounds is not enough to prove the
 * fixed-32 contract, so omitted or partial size metadata selects portable
 * kernels.
 */
export declare function selectParakeetExecutionProfile(availableFeatures: Iterable<string>, subgroupMinSize?: number, subgroupMaxSize?: number): ParakeetExecutionProfile;
export declare function snapshotParakeetWebGpuLimits(limits: GPUSupportedLimits | Readonly<Record<string, number>>): ParakeetWebGpuLimits;
/**
 * Compare requested device limits with adapter capabilities. WebGPU's `min*`
 * limits are lower-is-better, unlike the other limits.
 */
export declare function findWebGpuLimitDeficits(availableLimits: GPUSupportedLimits | Readonly<Record<string, number>>, requestedLimits: Readonly<Partial<Record<ParakeetWebGpuLimitName, number>>>): WebGpuLimitDeficit[];
export declare function requestWebGpuContext(options?: RequestWebGpuContextOptions): Promise<WebGpuContext>;
