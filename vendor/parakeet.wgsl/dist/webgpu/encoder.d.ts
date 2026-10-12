import type { ParakeetGpuPackage } from "../model/package";
import { type ActivationArenaBufferPlan, type ArenaSlice, GpuActivationArena } from "./arena";
import { type ParakeetExecutionProfile } from "./capabilities";
import { type F16PortableLoadEncoding } from "./kernels/gemm";
import type { EncoderDispatchShape } from "./kernels/execution-shape";
export declare const PARAKEET_FEATURE_BINS = 128;
export declare const PARAKEET_FEATURE_FRAMES = 1501;
export declare const PARAKEET_ENCODER_FRAMES = 188;
export declare const PARAKEET_SUBSAMPLING_CHANNELS = 256;
export declare const PARAKEET_ENCODER_CHANNELS = 1024;
export declare const PARAKEET_INTERMEDIATE_CHANNELS = 4096;
export declare const PARAKEET_PROJECTED_CHANNELS = 640;
export declare const PARAKEET_ENCODER_LAYERS = 24;
export declare const PARAKEET_ENCODER_BATCH_CAPACITY = 40;
export declare const PARAKEET_ENCODER_SUBMISSION_CHUNKS: number;
export declare const PARAKEET_ENCODER_LAYER_PALETTE_MATRICES = 10;
export declare const PARAKEET_TRANSIENT_PALETTE_MATRIX_COUNT: number;
export declare const PARAKEET_TRANSIENT_PALETTE_DISPATCHES_PER_GRAPH: number;
export declare const PARAKEET_TRANSIENT_PALETTE_EXPANDED_BYTES_PER_GRAPH = 1192755200;
export declare const PARAKEET_FP32_TRANSIENT_PALETTE_EXPANDED_BYTES_PER_GRAPH: number;
export declare const PARAKEET_SUBSAMPLING_MICROBATCH_SIZE = 3;
export interface EncoderMicrobatchPlan {
    readonly batchOffset: number;
    readonly batchSize: number;
    /** Direct flatten-project destination within encoder slot zero. */
    readonly output: ArenaSlice;
}
export interface SubsamplingArenaSlices {
    /** Ping aliases for the two depthwise outputs. */
    readonly stage376: ArenaSlice;
    readonly stage188: ArenaSlice;
    /** Pong aliases for the two pointwise outputs. */
    readonly projected376: ArenaSlice;
    readonly projected188: ArenaSlice;
}
export interface ParakeetEncoderArenaPlan {
    readonly precision: ParakeetExecutionProfile["precision"];
    readonly batchSize: typeof PARAKEET_ENCODER_BATCH_CAPACITY;
    readonly rows: number;
    readonly intermediateChannels: typeof PARAKEET_INTERMEDIATE_CHANNELS;
    readonly subsamplingMicrobatchSize: typeof PARAKEET_SUBSAMPLING_MICROBATCH_SIZE;
    /** Sum of the fixed physical activation buffers. */
    readonly byteLength: number;
    readonly buffers: readonly ActivationArenaBufferPlan[];
    /** External f32 input, physically `[batch, 128, 1501]` feature-major. */
    readonly featureInput: ArenaSlice;
    /** Raw feature-frame lengths uploaded by the caller. */
    readonly featureLengths: ArenaSlice;
    /** Three-times stride-2 lengths consumed by every attention layer. */
    readonly encoderLengths: ArenaSlice;
    /** Two full `[batch * 188, 1024]` alternating profile-scalar slots. */
    readonly encoderSlots: readonly [ArenaSlice, ArenaSlice];
    /** One `[batch * 188, 4096]` profile-scalar temporary, reused by all layers. */
    readonly bigTemporary: ArenaSlice;
    /** FFN view of `bigTemporary`, sized to this package's physical width. */
    readonly feedForwardTemporary: ArenaSlice;
    /** QKV `[batch * 188, 3072]` in the first three quarters of `bigTemporary`. */
    readonly attentionQkv: ArenaSlice;
    /** Attention context `[batch * 188, 1024]` in the final quarter. */
    readonly attentionContext: ArenaSlice;
    /** Convolution pointwise-1 `[batch * 188, 2048]` in the first half. */
    readonly convolutionPointwise: ArenaSlice;
    /** Fused convolution output `[batch * 188, 1024]` in the third quarter. */
    readonly convolutionOutput: ArenaSlice;
    /** Final `[batch * 188, 640]` profile-scalar projected output. */
    readonly projectedOutput: ArenaSlice;
    /** Dead encoder storage reused for persistent decoder state and outputs. */
    readonly decoderScratch: ArenaSlice;
    readonly subsampling: SubsamplingArenaSlices;
    /**
     * One prebuilt command variant for every active batch end B1-B40.
     *
     * Full B3 commands end at multiples of three. The intervening entries are
     * exact B1/B2 tails, so an arbitrary active prefix never reads or writes an
     * inactive sequence.
     */
    readonly microbatches: readonly EncoderMicrobatchPlan[];
    /** Output slot after each full Conformer layer. */
    readonly layerOutputSlots: readonly number[];
}
export interface EncoderLayerArenaPlan {
    readonly input: ArenaSlice;
    /** The other dedicated full slot at layer entry. */
    readonly alternate: ArenaSlice;
    /** Residual stream after the first FFN. */
    readonly postFeedForward1: ArenaSlice;
    /** Scratch/output slot used by attention and FF2 normalization. */
    readonly moduleScratch: ArenaSlice;
    readonly bigTemporary: ArenaSlice;
    readonly feedForwardTemporary: ArenaSlice;
    readonly attentionQkv: ArenaSlice;
    readonly attentionContext: ArenaSlice;
    readonly convolutionPointwise: ArenaSlice;
    readonly convolutionOutput: ArenaSlice;
    readonly outputSlot: number;
}
export interface EncoderLayerStructure {
    readonly logicalDispatches: number;
    readonly layerNormPasses: number;
    /** Matrix passes for FF1, excluding their transient expansions. */
    readonly feedForward1MatrixPasses: number;
    /** Logical dispatches plus one expansion before each layer GEMM. */
    readonly totalComputePasses: number;
}
export interface SubsamplingDispatchStructure {
    readonly unconditionalPerMicrobatch: number;
    readonly conditionalFinalMasksPerMicrobatch: number;
}
export interface EncoderUniformParameterPoolPlan {
    readonly bufferCount: 6;
    readonly uniqueSlotCount: number;
    readonly byteLength: number;
}
export interface ParakeetEncoderDecoderInput {
    readonly encoderProjected: ArenaSlice;
    readonly encodedLengths: ArenaSlice;
    readonly batchSize: number;
    readonly frames: typeof PARAKEET_ENCODER_FRAMES;
}
export interface ParakeetEncoderExecutionPlan extends EncoderDispatchShape {
    readonly microbatchCount: number;
}
export type EncoderSubmissionChunkPlan = {
    readonly kind: "subsampling";
    readonly label: "parakeet-encoder-subsampling";
    readonly layerIndex: null;
} | {
    readonly kind: "conformer-layer";
    readonly label: string;
    readonly layerIndex: number;
} | {
    readonly kind: "projector";
    readonly label: "parakeet-encoder-projector";
    readonly layerIndex: null;
};
export type EncoderB1CheckpointKind = "subsampling" | "layer" | "projector";
/**
 * One tightly packed slice in the diagnostic-only B1 encoder capture.
 *
 * `elementOffset` is precision-independent and therefore also indexes the
 * widened FP32 file emitted by the retained diagnostic page. `byteOffset`
 * indexes the precision-native GPU readback.
 */
export interface EncoderB1Checkpoint {
    readonly label: string;
    readonly kind: EncoderB1CheckpointKind;
    readonly layerIndex: number | null;
    readonly rows: typeof PARAKEET_ENCODER_FRAMES;
    readonly channels: typeof PARAKEET_ENCODER_CHANNELS | typeof PARAKEET_PROJECTED_CHANNELS;
    readonly elementOffset: number;
    readonly elementCount: number;
    readonly byteOffset: number;
    readonly byteLength: number;
}
export interface EncoderB1CheckpointPlan {
    readonly precision: ParakeetExecutionProfile["precision"];
    readonly elementBytes: 2 | 4;
    readonly elementCount: number;
    readonly byteLength: number;
    readonly widenedFloat32ByteLength: number;
    readonly checkpoints: readonly EncoderB1Checkpoint[];
}
export declare function deriveSubsamplingLengths(featureLength: number): readonly [number, number, number];
export declare function deriveEncoderValidLength(featureLength: number): number;
export declare function deriveEncoderValidLengths(featureLengths: readonly number[], batchSize?: number): Uint32Array<ArrayBuffer>;
export declare function planParakeetEncoderExecution(batchSize: number): ParakeetEncoderExecutionPlan;
export declare function subsamplingSliceNeedsFinalMask(validEncoderLengths: ArrayLike<number>, batchOffset: number, batchSize: number): boolean;
export declare function planEncoderLayerArena(plan: ParakeetEncoderArenaPlan, inputSlot: number): EncoderLayerArenaPlan;
export declare function planEncoderLayerStructure(): EncoderLayerStructure;
export declare function planEncoderSubmissionChunks(): readonly EncoderSubmissionChunkPlan[];
/**
 * Plans the bounded diagnostic capture after subsampling, after every complete
 * Conformer layer, and after the projector. This is deliberately B1-only and
 * is not part of the production encoder schedule.
 */
export declare function planEncoderB1Checkpoints(precision: ParakeetExecutionProfile["precision"]): EncoderB1CheckpointPlan;
export declare function planSubsamplingDispatchStructure(): SubsamplingDispatchStructure;
export declare function planEncoderUniformParameterPools(minUniformBufferOffsetAlignment: number): EncoderUniformParameterPoolPlan;
/**
 * Plans two mutually exclusive phases in one allocation. Slot zero and both
 * length tables remain live while subsampling fills slot zero. The external
 * feature input and ping-pong subsampling scratch then become encoder slot one
 * and the 4096-channel shared temporary.
 */
export declare function planParakeetEncoderArena(precision?: ParakeetExecutionProfile["precision"]): ParakeetEncoderArenaPlan;
export declare class ParakeetEncoderGraph {
    private readonly device;
    private readonly subsamplingPreparedWeights;
    private readonly subsamplingCommands;
    private readonly layerDispatches;
    private readonly projectorDispatch;
    private readonly allDispatches;
    private readonly ownedKernels;
    readonly arena: GpuActivationArena;
    readonly plan: ParakeetEncoderArenaPlan;
    readonly batchSize: number;
    readonly frames = 188;
    readonly transientPaletteParameterPoolBytes: number;
    readonly transientPaletteParameterPoolUsedSlots: number;
    readonly transientPaletteMatrixCount: number;
    readonly transientPaletteExpansionDispatches: number;
    readonly transientPaletteExpandedBytesPerGraph: number;
    readonly portableF16GemmLoadEncoding: F16PortableLoadEncoding | null;
    readonly uniformParameterPoolBytes: number;
    readonly uniformParameterPoolBufferCount: number;
    readonly uniformParameterPoolUsedSlots: number;
    private destroyed;
    private readonly featureInput;
    private readonly featureLengths;
    private constructor();
    static create(device: GPUDevice, model: ParakeetGpuPackage, executionProfile?: ParakeetExecutionProfile): Promise<ParakeetEncoderGraph>;
    uploadFeatures(features: Float32Array<ArrayBuffer>): void;
    uploadValidFeatureLengths(featureLengths: readonly number[]): Uint32Array<ArrayBuffer>;
    private encodeSubsampling;
    private encodeConformer;
    private encodeConformerLayer;
    private encodeProjector;
    encode(encoder: GPUCommandEncoder, validFeatureLengths: readonly number[]): void;
    /**
     * Records the production encoder as independently submitted scheduling
     * quanta without changing dispatch order or arithmetic.
     *
     * The caller must submit every returned command buffer in order while
     * retaining exclusive ownership of the shared graph and activation arena.
     * It may drain and yield between buffers, but no later batch may upload
     * features, controls, or parameters until this complete sequence and its
     * decoder/readback have finished.
     */
    encodeSubmissionChunks(validFeatureLengths: readonly number[]): readonly GPUCommandBuffer[];
    /**
     * Diagnostic-only B1 schedule with ordered copies at stable encoder
     * boundaries. The production `encode()` path and its command order remain
     * untouched; every compute dispatch here is one of the same graph-owned
     * dispatch objects used by `encode()`.
     */
    encodeDiagnosticB1Checkpoints(encoder: GPUCommandEncoder, validFeatureLength: number, destination: GPUBuffer, destinationByteOffset?: number): EncoderB1CheckpointPlan;
    decoderInput(): ParakeetEncoderDecoderInput;
    destroy(): void;
    private assertAlive;
    private copyDiagnosticCheckpoint;
}
