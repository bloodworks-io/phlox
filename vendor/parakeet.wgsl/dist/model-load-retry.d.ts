import { ModelTransportError } from "./model-transport";
export interface ModelLoadAttempt {
    readonly number: number;
    readonly fetch: typeof fetch;
    cancel(reason: unknown): Promise<void>;
}
export interface ModelLoadRetryEvent {
    readonly attempt: number;
    readonly nextAttempt: number;
    readonly maxAttempts: number;
    readonly delayMs: number;
    readonly error: ModelTransportError;
}
export interface ModelLoadRetryOptions {
    readonly fetch?: typeof fetch;
    readonly signal?: AbortSignal;
    readonly maxAttempts?: number;
    readonly baseDelayMs?: number;
    readonly maxDelayMs?: number;
    readonly maxRetryAfterMs?: number;
    readonly random?: () => number;
    readonly now?: () => number;
    readonly sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
    readonly cleanup?: (error: unknown) => Promise<void>;
    readonly recover?: (error: unknown) => boolean;
    readonly onRetry?: (event: ModelLoadRetryEvent) => void;
}
export declare class ModelLoadRetryExhaustedError extends Error {
    readonly attempts: number;
    readonly lastError: ModelTransportError;
    constructor(attempts: number, error: ModelTransportError);
}
/**
 * Runs an entire BrowserModelSet load attempt again only for explicitly
 * classified transient transport failures.
 */
export declare function runModelLoadWithRetry<T>(operation: (attempt: ModelLoadAttempt) => Promise<T>, options?: ModelLoadRetryOptions): Promise<T>;
