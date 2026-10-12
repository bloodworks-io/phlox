import { type StatelessWindowPlan } from "./chunking";
import { type TimedToken, type TokenPieceResolver } from "./stitch";
export declare const SEAM_GAP_MIN_FRAMES: number;
export declare const SEAM_GAP_MAX_PROBES = 32;
export declare const SEAM_GAP_MAX_ROUNDS = 3;
export declare const SEAM_GAP_EDGE_TOLERANCE_FRAMES = 6;
export type SeamRepairPlacement = "gap-start" | "centered";
export interface SeamGap<Token extends TimedToken = TimedToken> {
    readonly adjacentIndex: number;
    readonly startFrame: number;
    readonly endFrame: number;
    readonly startSample: number;
    readonly endSample: number;
    readonly leadNeighbor: Token;
    readonly tailNeighbor: Token;
}
/**
 * Identify a cold repair decode independently of its diagnostic window index.
 * The cache is deliberately stricter than the current engine requirements:
 * every other plan field participates so future scheduler changes cannot
 * accidentally reuse a decode across different timeline semantics.
 */
export declare function seamRepairPlanCacheKey(plan: StatelessWindowPlan): string;
/**
 * Resolve one adjacent inter-token gap on the same global 80 ms frame
 * timeline used by the TDT decoder. Energy gating and probe memoization are
 * intentionally left to the caller so an arbitrarily long file stays
 * streamed and bounded-memory.
 */
export declare function seamGapAt<Token extends TimedToken>(tokens: readonly Token[], adjacentIndex: number, totalSamples: number, tokenPiece: TokenPieceResolver): SeamGap<Token> | undefined;
/**
 * Plan FluidAudio's standalone, context-free repair probe while retaining the
 * existing fixed 240,000-sample Wasm/GPU input. Only 239,360 real samples are
 * exposed to the decoder; the remainder is right padding.
 */
export declare function planSeamRepairWindow(totalSamples: number, gap: Pick<SeamGap, "startSample" | "endSample">, placement: SeamRepairPlacement, index: number): StatelessWindowPlan;
/**
 * Filter a standalone probe down to an insertion-only, word-safe run strictly
 * inside its original gap. Existing merged tokens are never rewritten.
 */
export declare function spliceRepairCandidate<Token extends TimedToken>(windowTokens: readonly Token[], gap: Pick<SeamGap<Token>, "startFrame" | "endFrame" | "leadNeighbor" | "tailNeighbor">, tokenPiece: TokenPieceResolver): Token[];
