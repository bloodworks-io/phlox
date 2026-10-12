export interface ModelCacheAsset {
    readonly url: string;
    readonly byteLength: number;
    readonly sha256: string;
}
export interface StoredModelCacheInfo {
    readonly supported: boolean;
    readonly assetCount: number;
    readonly sizeBytes: number;
}
export declare function inspectStoredModels(storage?: CacheStorage | undefined): Promise<StoredModelCacheInfo>;
export declare function clearStoredModels(storage?: CacheStorage | undefined): Promise<void>;
