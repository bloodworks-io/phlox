import type { LineCitation } from "./types";
import { citationKey } from "./citations";

export interface MatchedCitation {
    citation: LineCitation;
    /** Index of the current text line the badge anchors to. */
    anchorLineIndex: number;
}

export const matchCitationsToLines = (
    currentText: string,
    citations: LineCitation[],
): MatchedCitation[] => {
    const lines = currentText.split("\n");
    const used = new Set<number>();
    const matched: MatchedCitation[] = [];
    for (const citation of citations) {
        if (!citation.text.trim()) continue;
        const anchorLineIndex = lines.findIndex(
            (line, index) => line === citation.text && !used.has(index),
        );
        if (anchorLineIndex === -1) continue;
        used.add(anchorLineIndex);
        matched.push({ citation, anchorLineIndex });
    }
    return matched;
};

/** True when every matched line is unverified (and at least one exists). */
export const isFullyUnverified = (matched: MatchedCitation[]): boolean =>
    matched.length > 0 && matched.every((entry) => entry.citation.verdict === "unverified");

/** Citations for one field with already-dismissed flags filtered out. */
export const activeCitations = (
    fieldKey: string,
    citations: LineCitation[],
    resolved: string[],
): LineCitation[] =>
    citations.filter(
        (citation) => !resolved.includes(citationKey(fieldKey, citation.line_index)),
    );
