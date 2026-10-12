export declare const AUDIO_DECODING_SCRATCH_ROOT = "parakeet-wgsl-audio-decoding";
/** Remove decode jobs abandoned by a crash or terminated browser worker. */
export declare function cleanupStaleAudioDecodingScratchData(): Promise<void>;
export declare function removeAudioDecodingScratchDirectory(name: string, retryMissing?: boolean): Promise<void>;
export declare function assertAudioDecodingOpfsAvailable(): void;
