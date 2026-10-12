import type { AudioDecodingRuntimeAssets } from "./audio-decoding-assets";
export interface StreamingAudioDecoderSession {
    readonly inputByteLength: number;
    /** Advisory only; the inference worker reconciles against exact PCM EOF. */
    readonly estimatedSampleCount: number | null;
    /** Transfer exactly once to the inference worker's prepare-stream message. */
    takePort(): MessagePort;
    /** Idempotently terminate decode, close the local port, and remove OPFS data. */
    cleanup(): Promise<void>;
}
/**
 * Open and validate a compressed/container source before model initialization.
 * Once ready, the isolated decoder immediately spools immutable PCM segments;
 * its data port can queue disk-backed File snapshots while the model loads.
 */
export declare function openStreamingAudioDecoder(audio: Blob, sourceName: string, assets: AudioDecodingRuntimeAssets, signal: AbortSignal, onWorkerFailure?: (error: unknown) => void): Promise<StreamingAudioDecoderSession>;
