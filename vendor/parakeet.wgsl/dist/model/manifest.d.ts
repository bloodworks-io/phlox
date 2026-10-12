export declare const PARAKEET_FP16_PACKAGE_FORMAT = "parakeet-webgpu-v1";
export declare const PARAKEET_FP32_PACKAGE_FORMAT = "parakeet-webgpu-fp32-v1";
export declare const PARAKEET_FP16_ENCODER_WEIGHT_FORMAT = "mixed-palette5-o-proj-palette6-fp16-lut";
export declare const PARAKEET_FP32_ENCODER_WEIGHT_FORMAT = "mixed-palette5-o-proj-palette6-fp32-lut";
export declare const PARAKEET_FP16_MANIFEST_SHA256 = "11a359db3d050fd82b002c745b24a5280f3ff13a76834b548df671c95c786c65";
export declare const PARAKEET_FP32_MANIFEST_SHA256 = "28dee836aefc2bfb01236fda6d10e1df7447724d2489040168549999ea267b1b";
export declare const PARAKEET_FFN_SOURCE_WIDTH = 4096;
export declare const PARAKEET_SOURCE_REVISION = "ae9ad07059c7c739ffaf932226a8fe64ae2620b0";
export declare const PARAKEET_SOURCE_ARCHIVE_NAME = "parakeet-tdt-0.6b-v2.nemo";
export declare const PARAKEET_SOURCE_ARCHIVE_BYTE_LENGTH = 2472222720;
export declare const PARAKEET_SOURCE_ARCHIVE_SHA256 = "d99e39955c9d3d0350d8fb7c75e40c64a2b2eaeb003883d7c941fd2e8747b28c";
export declare const PARAKEET_SOURCE_WEIGHTS_NAME = "model_weights.ckpt";
export declare const PARAKEET_SOURCE_WEIGHTS_BYTE_LENGTH = 2471920514;
export declare const PARAKEET_SOURCE_WEIGHTS_SHA256 = "fb1cbe2765fb80c02c0f874b6ea2c2bd24048c3618c092584fd086c6366e48a9";
export declare const OMIMED_FP16_MANIFEST_SHA256 = "cf535dd1050c9ce42b7785f05c1d0c164d64defc0220d74df4e91d159fc4fe39";
export declare const OMIMED_SOURCE_REPOSITORY = "omi-health/omi-med-stt-v1";
export declare const OMIMED_SOURCE_REVISION = "dc854cd350873636bf38bdf94b226f5ad7eaa2bd";
export declare const OMIMED_SOURCE_ARCHIVE_NAME = "omimedstt-v1.nemo";
export declare const OMIMED_SOURCE_ARCHIVE_BYTE_LENGTH = 2497627648;
export declare const OMIMED_SOURCE_ARCHIVE_SHA256 = "eaf0ff7258133b4e597aef024f81a4db1779abeb966e53f00a2250bb54e0fbf4";
export declare const OMIMED_SOURCE_WEIGHTS_NAME = "model_weights.ckpt";
export declare const OMIMED_SOURCE_WEIGHTS_BYTE_LENGTH = 2497321001;
export declare const OMIMED_SOURCE_WEIGHTS_SHA256 = "970580f0128dea97817662a4244bc9e0ea7f78156675e9383d6e11f60d478137";
export declare const OMIMED_ENCODER_ADAPTER = "medical-1d-r128";
export type ParakeetModelPrecision = "fp16" | "fp32";
export interface ParakeetTensorRecord {
    readonly shard: string;
    readonly byteOffset: number;
    readonly byteLength: number;
    readonly dtype: "float16" | "float32" | "uint32";
    readonly logicalShape: readonly number[];
    readonly storageShape: readonly number[];
    readonly layout: string;
}
export interface ParakeetFileRecord {
    readonly name: string;
    readonly byteLength: number;
    readonly sha256: string;
}
interface ParakeetCommonModelConfig {
    readonly sampleRate: 16000;
    readonly windowSamples: 240000;
    readonly windowSeconds: 15;
    readonly windowOverlapSeconds: 2;
    readonly featureBins: 128;
    readonly fftSize: 512;
    readonly windowSize: 400;
    readonly hopSize: 160;
    readonly preemphasis: number;
    readonly logZeroGuard: number;
    readonly normalizationEpsilon: number;
    readonly subsamplingFactor: 8;
    readonly encoderLayers: 24;
    readonly encoderHiddenSize: 1024;
    readonly attentionHeads: 8;
    readonly attentionHeadSize: 128;
    readonly convolutionKernelSize: 9;
    readonly decoderHiddenSize: 640;
    readonly decoderLayers: 2;
    readonly vocabularySize: 1025;
    readonly blankTokenId: 1024;
    readonly jointOutputSize: 1030;
    readonly jointStorageOutputSize: 1032;
    readonly durations: readonly [0, 1, 2, 3, 4];
    readonly maxSymbolsPerStep: 10;
    /** OmiMed fork marker: presence selects the per-layer adapter dispatches. */
    readonly encoderAdapter?: typeof OMIMED_ENCODER_ADAPTER;
}
export interface ParakeetFp16ModelConfig extends ParakeetCommonModelConfig {
    readonly intermediateSize: typeof PARAKEET_FFN_SOURCE_WIDTH;
    readonly encoderWeightFormat: typeof PARAKEET_FP16_ENCODER_WEIGHT_FORMAT;
}
export interface ParakeetFp32ModelConfig extends ParakeetCommonModelConfig {
    readonly intermediateSize: typeof PARAKEET_FFN_SOURCE_WIDTH;
    readonly encoderWeightFormat: typeof PARAKEET_FP32_ENCODER_WEIGHT_FORMAT;
}
interface ParakeetManifestBase {
    readonly source: {
        readonly repository: string;
        readonly revision: string;
        readonly archive: {
            readonly name: string;
            readonly byteLength: number;
            readonly sha256: string;
        };
        readonly weights: {
            readonly name: string;
            readonly byteLength: number;
            readonly sha256: string;
        };
        readonly license: "CC-BY-4.0";
    };
    readonly files: readonly ParakeetFileRecord[];
    readonly tensors: Readonly<Record<string, ParakeetTensorRecord>>;
}
export interface ParakeetFp16Manifest extends ParakeetManifestBase {
    readonly format: typeof PARAKEET_FP16_PACKAGE_FORMAT;
    readonly config: ParakeetFp16ModelConfig;
}
export interface ParakeetFp32Manifest extends ParakeetManifestBase {
    readonly format: typeof PARAKEET_FP32_PACKAGE_FORMAT;
    readonly config: ParakeetFp32ModelConfig;
}
export type ParakeetManifest = ParakeetFp16Manifest | ParakeetFp32Manifest;
export declare function parakeetManifestPrecision(manifest: ParakeetManifest): ParakeetModelPrecision;
export declare function parakeetManifestSha256(precision: ParakeetModelPrecision): string;
/** Manifest identities this fork accepts per precision (canonical + OmiMed). */
export declare function parakeetAcceptedManifestSha256s(precision: ParakeetModelPrecision): readonly string[];
export declare function parseParakeetManifest(value: unknown): ParakeetManifest;
export {};
