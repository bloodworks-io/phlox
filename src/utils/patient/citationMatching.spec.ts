import { describe, it, expect } from "vitest";
import {
    activeCitations,
    isFullyUnverified,
    matchCitationsToLines,
    provenanceExemptKeys,
} from "./citationMatching";
import type { LineCitation } from "./types";

const cite = (line_index: number, text: string, verdict: LineCitation["verdict"] = "supported"): LineCitation => ({
    line_index,
    text,
    sources: verdict === "supported" ? [0] : [],
    contradicts: verdict === "conflict" ? [1] : [],
    verdict,
});

describe("matchCitationsToLines", () => {
    it("anchors citations by exact text snapshot", () => {
        const matched = matchCitationsToLines("• Fatigue\n• No chest pain", [
            cite(0, "• Fatigue"),
            cite(1, "• No chest pain", "conflict"),
        ]);
        expect(matched.map((m) => m.anchorLineIndex)).toEqual([0, 1]);
    });

    it("suppresses badges for edited or reworded lines", () => {
        const matched = matchCitationsToLines("• Fatigue, much worse\n• No chest pain", [
            cite(0, "• Fatigue"),
            cite(1, "• No chest pain"),
        ]);
        expect(matched.map((m) => m.anchorLineIndex)).toEqual([1]);
    });

    it("follows reordered text instead of position", () => {
        const matched = matchCitationsToLines("• No chest pain\n• Fatigue", [
            cite(0, "• Fatigue"),
            cite(1, "• No chest pain", "unverified"),
        ]);
        expect(matched.map((m) => m.anchorLineIndex)).toEqual([1, 0]);
    });

    it("assigns duplicate snapshots first-unmatched", () => {
        const matched = matchCitationsToLines("• Review\n• Review", [
            cite(0, "• Review"),
            cite(1, "• Review"),
        ]);
        expect(matched.map((m) => m.anchorLineIndex)).toEqual([0, 1]);
    });

    it("skips empty-line snapshots and empty text", () => {
        expect(matchCitationsToLines("a\n\nb", [cite(1, "")])).toEqual([]);
        expect(matchCitationsToLines("", [cite(0, "a")])).toEqual([]);
    });
});

describe("isFullyUnverified", () => {
    it("is true only when all lines are unverified", () => {
        expect(isFullyUnverified(matchCitationsToLines("a\nb", [cite(0, "a", "unverified"), cite(1, "b", "unverified")]))).toBe(true);
        expect(isFullyUnverified(matchCitationsToLines("a\nb", [cite(0, "a", "unverified"), cite(1, "b", "conflict")]))).toBe(false);
        expect(isFullyUnverified([])).toBe(false);
    });
});

describe("activeCitations", () => {
    it("filters dismissed flags by field-qualified key", () => {
        const citations = [cite(0, "a", "unverified"), cite(1, "b", "conflict")];
        const active = activeCitations("examination", citations, ["examination::1"]);
        expect(active.map((c) => c.line_index)).toEqual([0]);
    });
});

describe("provenanceExemptKeys", () => {
    it("exempts clinician-added lines but not verbatim agent lines", () => {
        const keys = provenanceExemptKeys(
            { plan: "• Agent line\n• Clinician line" },
            { plan: "• Agent line" },
        );
        expect(keys).toEqual(["plan::1"]);
    });

    it("exempts every line of a field the agent never touched (carried content)", () => {
        const keys = provenanceExemptKeys({ pmh: "• HTN\n• T2DM" }, {});
        expect(keys).toEqual(["pmh::0", "pmh::1"]);
    });

    it("exempts agent lines the clinician edited (reworded text)", () => {
        const keys = provenanceExemptKeys(
            { plan: "• Agent line, reworded" },
            { plan: "• Agent line" },
        );
        expect(keys).toEqual(["plan::0"]);
    });

    it("never keys empty lines and skips empty fields", () => {
        const keys = provenanceExemptKeys({ plan: "a\n\nb", empty: "  " }, { plan: "a" });
        expect(keys).toEqual(["plan::2"]);
    });

    it("matches agent lines regardless of position (renumber-safe)", () => {
        const keys = provenanceExemptKeys(
            { plan: "• Two\n• One" },
            { plan: "• One\n• Two" },
        );
        expect(keys).toEqual([]);
    });
});
