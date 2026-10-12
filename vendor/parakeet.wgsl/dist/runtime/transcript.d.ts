import type { TranscriptionToken, TranscriptionWord } from "./protocol";
import type { TimedToken } from "./stitch";
export interface TranscriptDecoder {
    decodeTokenIds(tokenIds: readonly number[]): string;
    tokenPiece(tokenId: number): string | undefined;
}
export interface SerializedTimedTranscript {
    readonly text: string;
    readonly tokens: readonly TranscriptionToken[];
    readonly words: readonly TranscriptionWord[];
}
/**
 * Serialize one timestamped token stream without discarding either the raw
 * token timing or word-level timing used by presentation layers.
 *
 * The pinned tokenizer uses a SentencePiece-style `▁` boundary marker.
 * Punctuation and continuation pieces remain attached to the preceding word.
 */
export declare function serializeTimedTranscript(timedTokens: readonly TimedToken[], sampleRate: number, decoder: TranscriptDecoder): SerializedTimedTranscript;
