/**
 * Fixed first pull: strict lookahead for forty stable non-final primary
 * windows. An EOF before this bound resolves a short file in the same pull.
 */
export declare const STREAMING_DECODER_INITIAL_SAMPLES: number;
/**
 * Subsequent pulls cover forty primary strides. This keeps segment metadata
 * small while bounding the decoder's live output to about 16.5 MB.
 */
export declare const STREAMING_DECODER_STEADY_SAMPLES: number;
export interface StartStreamingDecodeRequest {
    readonly type: "start-streaming-decode";
    readonly requestId: string;
    readonly audio: Blob;
    readonly fileName: string;
    readonly ffmpegCoreWasm: string;
    readonly scratchDirectory: string;
    readonly port: MessagePort;
}
export interface StreamingDecoderReadyResponse {
    readonly type: "streaming-decoder-ready";
    readonly requestId: string;
    /**
     * Best-effort selected-audio duration rescaled to 16 kHz. Codec trimming,
     * timestamp edits, and final resampler drain can change the exact EOF count.
     */
    readonly estimatedSampleCount: number | null;
}
export interface StreamingDecoderOpenFailedResponse {
    readonly type: "streaming-decoder-open-failed";
    readonly requestId: string;
    readonly message: string;
}
export type StreamingDecoderControlResponse = StreamingDecoderReadyResponse | StreamingDecoderOpenFailedResponse;
export interface StreamingPcmSegmentMessage {
    readonly type: "pcm-segment";
    readonly segmentIndex: number;
    readonly startSample: number;
    readonly sampleCount: number;
    /** Immutable OPFS snapshot obtained after its sync handle was closed. */
    readonly file: File;
}
export interface StreamingPcmEndMessage {
    readonly type: "pcm-end";
    readonly totalSamples: number;
    readonly outputByteLength: number;
    /** Full worker session, including lazy core startup and OPFS writes. */
    readonly decoderWallMs: number;
    /** Sum of time spent inside bounded native decode steps. */
    readonly decoderActiveMs: number;
    /** Comparable monotonic epoch timestamps across same-origin workers. */
    readonly decoderStartedAtMs: number;
    readonly decoderEndedAtMs: number;
}
export interface StreamingPcmFailureMessage {
    readonly type: "pcm-failed";
    readonly message: string;
}
export type StreamingPcmProducerMessage = StreamingPcmSegmentMessage | StreamingPcmEndMessage | StreamingPcmFailureMessage;
export declare function isStreamingDecoderControlResponse(value: unknown, requestId: string): value is StreamingDecoderControlResponse;
export declare function isStreamingPcmProducerMessage(value: unknown): value is StreamingPcmProducerMessage;
