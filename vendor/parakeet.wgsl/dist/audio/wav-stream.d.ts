/**
 * Bounded-memory random access for Parakeet's canonical input format.
 *
 * A Blob/File is never materialized as one ArrayBuffer. Header fields are read
 * through small slices and PCM is decoded through one reusable BYOB backing
 * store. `consume` callbacks are synchronous because Chrome transfers the BYOB
 * backing ArrayBuffer on every read.
 */
export declare const PARAKEET_SAMPLE_RATE: 16000;
export declare const PARAKEET_CHANNELS: 1;
export declare const PARAKEET_BITS_PER_SAMPLE: 16;
export declare const WAV_REUSABLE_READ_BUFFER_BYTES = 320000;
export declare const DEFAULT_PCM_STREAM_SAMPLES = 160000;
export interface RandomAccessByteSource {
    readonly size: number;
    read(offset: number, length: number): Promise<ArrayBuffer>;
}
export interface ReusableChunkByteSource extends RandomAccessByteSource {
    readonly reusableReadBufferBytes: number;
    consume(offset: number, length: number, consumer: (bytes: Uint8Array) => void): Promise<void>;
}
export interface Pcm16WavInfo {
    readonly sampleRate: typeof PARAKEET_SAMPLE_RATE;
    readonly channels: typeof PARAKEET_CHANNELS;
    readonly bitsPerSample: typeof PARAKEET_BITS_PER_SAMPLE;
    readonly sampleCount: number;
    readonly dataOffset: number;
    readonly dataByteLength: number;
}
export declare class WavFormatError extends Error {
    constructor(message: string);
}
/**
 * Return whether Parakeet will need to decode an audio Blob with FFmpeg.
 *
 * This uses the same strict parser as the transcription fast path, so a
 * canonical 16 kHz mono PCM16 WAV is guaranteed to bypass FFmpeg and OPFS.
 */
export declare function requiresAudioDecoding(audio: Blob): Promise<boolean>;
export declare class BlobByteSource implements ReusableChunkByteSource {
    private readonly blob;
    readonly size: number;
    readonly reusableReadBufferBytes = 320000;
    private reusable;
    private consumeTail;
    constructor(blob: Blob);
    read(offset: number, length: number): Promise<ArrayBuffer>;
    consume(offset: number, length: number, consumer: (bytes: Uint8Array) => void): Promise<void>;
    private consumeUnlocked;
}
/**
 * Bounded random-access reader for 16 kHz, mono PCM16 WAV.
 *
 * RIFF chunks are walked by declared size and odd-byte padding, so metadata
 * chunks such as `LIST`, `JUNK`, `bext`, and `iXML` never need to be loaded.
 */
export declare class Pcm16WavReader {
    private readonly source;
    readonly info: Pcm16WavInfo;
    private constructor();
    static open(input: Blob | RandomAccessByteSource): Promise<Pcm16WavReader>;
    get sampleRate(): typeof PARAKEET_SAMPLE_RATE;
    get sampleCount(): number;
    get reusableReadBufferBytes(): number;
    /**
     * Decode a requested range into caller-owned storage. The request is clipped
     * at EOF and the returned number is the exact count written.
     */
    readSamplesInto(startSample: number, target: Float32Array, targetOffset?: number, sampleCount?: number): Promise<number>;
}
