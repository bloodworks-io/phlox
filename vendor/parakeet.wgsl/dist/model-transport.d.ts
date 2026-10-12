export type ModelTransportPhase = "request" | "response" | "body";
export interface ModelTransportErrorOptions {
    readonly url: string;
    readonly phase: ModelTransportPhase;
    readonly attempt?: number;
    readonly status?: number;
    readonly retryAfterMs?: number;
    readonly retryable: boolean;
    readonly detail?: string;
    readonly cause?: unknown;
}
/**
 * A failure while transferring one of the files that make up a browser model.
 *
 * HTTP failures are represented here as well so the model-set loader has one
 * explicit retry classification instead of relying on browser-specific error
 * strings.
 */
export declare class ModelTransportError extends Error {
    readonly url: string;
    readonly phase: ModelTransportPhase;
    readonly attempt: number | undefined;
    readonly status: number | undefined;
    readonly retryAfterMs: number | undefined;
    readonly retryable: boolean;
    readonly detail: string | undefined;
    constructor(options: ModelTransportErrorOptions);
}
interface ModelFetchAttemptOptions {
    readonly attempt: number;
    readonly signal?: AbortSignal;
    readonly now?: () => number;
}
/**
 * One cancellable set of model requests. A fresh instance is created whenever
 * the selected Parakeet package restarts after a transient failure.
 */
export declare class ModelFetchAttempt {
    private readonly networkFetch;
    private readonly options;
    readonly fetch: typeof fetch;
    private readonly controller;
    private readonly activeBodies;
    private readonly now;
    private cancellation;
    constructor(networkFetch: typeof fetch, options: ModelFetchAttemptOptions);
    cancel(reason: unknown): Promise<void>;
    private fetchModelAsset;
    private wrapBody;
}
export declare function modelBodyFailure(url: string, cause: unknown, attempt?: number): ModelTransportError;
export declare function truncatedModelBody(url: string, actualBytes: number, expectedBytes: number): ModelTransportError;
export declare function isRetryableHttpStatus(status: number): boolean;
export {};
