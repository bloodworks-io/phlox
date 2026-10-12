/**
 * Decode-only implementation of NVIDIA's official tokenizer.json.
 *
 * BPE merges are needed to encode text, not to decode model token IDs. Decoding
 * is exactly an ID-to-piece lookup followed by the fixed v2 Metaspace decoder.
 */
export declare class ParakeetTokenizer {
    #private;
    readonly vocabularySize: number;
    readonly blankTokenId: number;
    private constructor();
    static fromJSON(value: unknown): ParakeetTokenizer;
    /** Raw tokenizer piece used for token-aware long-form seam handling. */
    pieceForTokenId(id: number): string;
    decode(tokenIds: Iterable<number>): string;
}
