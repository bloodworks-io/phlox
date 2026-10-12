import { type StatelessWindowPlan } from "./chunking";
import type { TdtEmittedToken } from "./tdt-types";
export interface TimedToken {
    readonly tokenId: number;
    readonly startSample: number;
    readonly endSample: number;
    /** Raw TDT duration, retained for conservative seam-gap boundaries. */
    readonly durationFrames: number;
}
export interface DecodedTokenWindow<Token extends TimedToken = TimedToken> {
    readonly index: number;
    /** Logical emission range, not an end-aligned window's physical read range. */
    readonly startSample: number;
    readonly endSample: number;
    readonly tokens: readonly Token[];
}
export type TokenPieceResolver = (tokenId: number) => string | undefined;
export type StitchMethod = "disjoint" | "contiguous" | "lcs" | "midpoint";
export interface StitchTrace {
    readonly leftWindowIndex: number;
    readonly rightWindowIndex: number;
    readonly method: StitchMethod;
    readonly overlapStartSample: number;
    readonly overlapEndSample: number;
}
export interface StitchedTokens<Token extends TimedToken = TimedToken> {
    readonly tokens: readonly Token[];
    readonly trace: readonly StitchTrace[];
}
export interface IncrementalStitchAccumulatorOptions {
    readonly tokenPiece?: TokenPieceResolver;
    /**
     * Retain one diagnostic record per appended seam. Production callers that
     * only need tokens can leave this disabled to avoid trace allocations.
     */
    readonly collectTrace?: boolean;
}
/**
 * Convert local compressed-timeline TDT frames into source-sample offsets.
 * Each encoder frame maps to 1,280 source samples. Hidden acoustic context and
 * a final window's real-audio backfill are suppressed by the window's logical
 * emission range.
 */
export declare function globalizeTdtTokens(tokens: readonly TdtEmittedToken[], window: StatelessWindowPlan): readonly TimedToken[];
/**
 * Merge independently decoded windows using the pinned FluidAudio behavior
 * as the operational reference. This remains a parakeet.wgsl
 * implementation: sample offsets are native to our engine and no native
 * worker or CoreML scheduling is imported.
 *
 * Reference: FluidAudio ChunkProcessor.swift at
 * 5390df9752c8fc583596018360c5fd70d6fa6c75 (Apache-2.0), including the
 * merge-order correction from c802b43ca9ececd0f4870dedaf6fb95a4d27d3eb.
 */
export declare function stitchTokenWindows<Token extends TimedToken>(windows: readonly DecodedTokenWindow<Token>[], tokenPiece?: TokenPieceResolver): StitchedTokens<Token>;
/**
 * Exact streaming form of `stitchTokenWindows` for windows that are already
 * ordered by `(startSample, index)`.
 *
 * Every call to `append` performs only the newly introduced seam merge.
 * `snapshot` finalizes a copy, so timestamp clamping and duplicate collapse
 * never mutate the merge state needed by a later window.
 */
export declare class IncrementalStitchAccumulator<Token extends TimedToken = TimedToken> {
    #private;
    constructor(options?: IncrementalStitchAccumulatorOptions);
    append(window: DecodedTokenWindow<Token>): void;
    snapshot(): StitchedTokens<Token>;
}
/**
 * Keep the merge-produced text order authoritative while making its timing
 * metadata non-decreasing. TDT can emit multiple pieces on one 80 ms frame,
 * and independently decoded overlap windows can place a later text piece on
 * a slightly earlier global frame. Sorting on that coarse timestamp corrupts
 * the splice order; clamp the later interval forward instead.
 *
 * Adjusted tokens are copied and their complete interval is shifted by the
 * same delta, preserving duration and any additional token fields. Neither
 * the input array nor its token objects are mutated.
 */
export declare function enforceMonotonicTokenTimes<Token extends TimedToken>(tokens: readonly Token[]): Token[];
export declare function isSpliceSafeToken(tokenId: number, tokenPiece: TokenPieceResolver): boolean;
export declare function isPunctuationOnlyToken(tokenId: number, tokenPiece: TokenPieceResolver): boolean;
export declare function tokenIdsMatch(leftTokenId: number, rightTokenId: number, tokenPiece: TokenPieceResolver): boolean;
export declare function collapseSeamWordDuplicates<Token extends TimedToken>(tokens: readonly Token[], tokenPiece: TokenPieceResolver): Token[];
