import type { LineCitation, NoteCitations } from "./types";

export const buildNoteCitations = (
    citations: Record<string, LineCitation[]> | null | undefined,
    rawTranscription: string | null | undefined,
): NoteCitations | null => {
    if (!citations || Object.keys(citations).length === 0) return null;
    return {
        transcript_line_count: (rawTranscription ?? "").split("\n").length,
        resolved: [],
        fields: citations,
    };
};

/** Stable identity of one flag: "field_key::line_index" (the resolved-set key). */
export const citationKey = (fieldKey: string, lineIndex: number): string =>
    `${fieldKey}::${lineIndex}`;
