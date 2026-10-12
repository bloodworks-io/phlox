export interface StreamingDecoderTimings {
    readonly decoderWallMs: number;
    readonly decoderActiveMs: number;
    readonly decoderStartedAtMs: number;
    readonly decoderEndedAtMs: number;
}
export interface PcmAvailability {
    readonly availableSamples: number;
    readonly ended: boolean;
}
/**
 * Random-access PCM16 reader over immutable OPFS segment snapshots.
 *
 * The producer closes every segment's sync handle before posting its File, so
 * reads never race a writer or depend on growing-File snapshot semantics.
 */
export declare class SegmentedPcm16Reader {
    private readonly port;
    readonly sampleRate: 16000;
    private readonly segments;
    private readonly waiters;
    private available;
    private end;
    private failure;
    private disposed;
    private consumeTail;
    constructor(port: MessagePort);
    get availableSampleCount(): number;
    get ended(): boolean;
    get sampleCount(): number;
    get decoderTimings(): StreamingDecoderTimings | undefined;
    waitForSamples(minimumSamples: number, signal?: AbortSignal): Promise<PcmAvailability>;
    waitForEnd(signal?: AbortSignal): Promise<PcmAvailability>;
    readSamplesInto(startSample: number, target: Float32Array, targetOffset?: number, sampleCount?: number): Promise<number>;
    dispose(reason?: unknown): void;
    private readonly handleMessage;
    private readAvailableRange;
    private availability;
    private resolveWaiters;
    private fail;
    private rejectWaiters;
}
