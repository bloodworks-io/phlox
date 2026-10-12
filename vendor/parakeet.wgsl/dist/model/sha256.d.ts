/** Incremental SHA-256 used while a weight response is uploaded to the GPU. */
export declare class IncrementalSha256 {
    private readonly state;
    private readonly pending;
    private readonly schedule;
    private pendingBytes;
    private totalBytes;
    private finished;
    update(data: Uint8Array): this;
    digestHex(): string;
    private compress;
}
