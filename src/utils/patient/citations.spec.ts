import { describe, it, expect } from "vitest";
import { buildNoteCitations, citationKey } from "./citations";
import type { LineCitation } from "./types";

const line: LineCitation = {
    line_index: 0,
    text: "• Bloods",
    sources: [1],
    contradicts: [],
    verdict: "supported",
};

describe("buildNoteCitations", () => {
    it("wraps citations in the envelope with the transcript line count", () => {
        const envelope = buildNoteCitations({ plan: [line] }, "a\nb\nc");
        expect(envelope).toEqual({
            transcript_line_count: 3,
            resolved: [],
            fields: { plan: [line] },
        });
    });

    it("treats a missing transcript as a single (empty) line", () => {
        expect(buildNoteCitations({ plan: [line] }, null)?.transcript_line_count).toBe(1);
    });

    it("returns null when there is nothing to ground", () => {
        expect(buildNoteCitations({}, "a\nb")).toBeNull();
        expect(buildNoteCitations(null, "a\nb")).toBeNull();
        expect(buildNoteCitations(undefined, "a\nb")).toBeNull();
    });
});

describe("citationKey", () => {
    it("builds the resolved-set identity for one flag", () => {
        expect(citationKey("examination", 3)).toBe("examination::3");
    });
});
