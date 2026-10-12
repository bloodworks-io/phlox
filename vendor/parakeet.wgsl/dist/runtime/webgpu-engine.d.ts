import { type ParakeetModelPrecision } from "../model/manifest";
import { ParakeetTokenizer } from "../model/tokenizer";
import { type StatelessWindowPlan } from "./chunking";
import type { ParakeetInferenceEngineFactory } from "./worker";
import { type ArenaSlice } from "../webgpu/arena";
import { ParakeetEncoderGraph } from "../webgpu/encoder";
export declare const INFERENCE_BATCH_SIZE = 40;
export declare const FEATURE_UPLOAD_MODE: "batch";
/**
 * Production deliberately does not enable timestamp-query on the device.
 *
 * Chrome/Dawn on the target Metal backend produced zero query values for the
 * full Parakeet command buffer and later submissions on a reused inference
 * slot could replay stale output. Focused benchmark pages still opt into
 * timestamp-query independently.
 */
export declare const PRODUCTION_GPU_TIMING_SOURCE: "submit-to-readback-wall";
export declare const PRODUCTION_OPTIONAL_WEBGPU_FEATURES: readonly [];
export declare const INFERENCE_SLOT_COUNT = 2;
export declare const ENCODER_GRAPH_COUNT = 1;
export declare const INFERENCE_COMMAND_BUFFERS_PER_GRAPH: number;
export declare const COOPERATIVE_GPU_QUEUE_DRAINS_PER_GRAPH: number;
export declare const COOPERATIVE_GPU_IDLE_MILLISECONDS = 1;
export declare const PRODUCTION_GPU_SUBMISSION_MODE: "queue-drained-subsampling-layer-projector-decoder";
export declare const FEATURE_STAGING_BYTES: number;
export declare const DECODER_CONTROL_STAGING_BYTES: number;
export declare function selectModelManifestUrl(configuration: {
    readonly fp16ModelUrl: string;
    readonly fp32ModelUrl: string;
}, precision: ParakeetModelPrecision): string;
export declare function validateTokenizerModelContract(tokenizer: Pick<ParakeetTokenizer, "blankTokenId" | "vocabularySize">, config: {
    readonly blankTokenId: number;
    readonly vocabularySize: number;
}): void;
export interface DecoderArenaLayout {
    readonly batchCapacity: number;
    readonly maxTokens: number;
    readonly decodeStarts: ArenaSlice;
    readonly decodeEnds: ArenaSlice;
    readonly flushFinals: ArenaSlice;
    readonly state: ArenaSlice;
    readonly predictorScratch: ArenaSlice;
    readonly tokens: ArenaSlice;
    readonly tokenFrames: ArenaSlice;
    readonly tokenDurations: ArenaSlice;
    readonly metadata: ArenaSlice;
}
export interface DecoderReadbackCopy {
    readonly sourceByteOffset: number;
    readonly destinationByteOffset: number;
    readonly byteLength: number;
}
export interface DecoderReadbackLayout {
    readonly activeBatchSize: number;
    readonly tokens: ArenaSlice;
    readonly tokenFrames: ArenaSlice;
    readonly tokenDurations: ArenaSlice;
    readonly metadata: ArenaSlice;
    readonly copies: readonly DecoderReadbackCopy[];
    readonly readbackByteLength: number;
}
export declare class ExclusiveAsyncGate {
    private tail;
    acquire(): Promise<() => void>;
}
/**
 * Submits one scheduling quantum at a time. The optional completion callback
 * runs only for drained non-final buffers while the queue-empty timer is
 * already active; the caller reports the final decoder/readback buffer after
 * its existing map fence succeeds.
 */
export declare function submitCommandBuffersCooperatively(queue: Pick<GPUQueue, "submit" | "onSubmittedWorkDone">, commandBuffers: readonly GPUCommandBuffer[], signal: AbortSignal, yieldQueueIdle?: () => Promise<void>, onCommandBufferCompleted?: (completedCommandBuffers: number, totalCommandBuffers: number) => void): Promise<void>;
export declare function validateDecoderFrameRange(window: Pick<StatelessWindowPlan, "index" | "decodeStartFrame" | "decodeEndFrame">, validEncoderLength: number): void;
export declare const createRawWebGpuParakeetEngine: ParakeetInferenceEngineFactory;
export declare function planDecoderArena(encoder: ParakeetEncoderGraph, maxTokens: number): DecoderArenaLayout;
/**
 * Restore the three small decoder-control tables only after the encoder has
 * finished using their aliased activation-arena storage.
 *
 * A queue.writeBuffer directly into these slices is incorrect: queue writes
 * execute before the submitted command buffer, so conformer/projector work
 * overwrites the controls before the decoder can consume them.
 */
export declare function encodeDecoderControlCopies(encoder: GPUCommandEncoder, staging: GPUBuffer, graph: ParakeetEncoderGraph, layout: DecoderArenaLayout): void;
export declare function planDecoderReadback(layout: DecoderArenaLayout, activeBatchSize: number): DecoderReadbackLayout;
export declare function encodeDecoderReadbackCopies(encoder: GPUCommandEncoder, source: GPUBuffer, destination: GPUBuffer, layout: DecoderReadbackLayout, destinationBase?: number): void;
