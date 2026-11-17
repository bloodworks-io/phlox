import { describe, expect, it } from "vitest";
import { lineDiff } from "./lineDiff";

describe("lineDiff", () => {
    it("returns all-same for identical content", () => {
        const rows = lineDiff("• Hypertension\n• T2DM", "• Hypertension\n• T2DM");
        expect(rows).toEqual([
            { type: "same", text: "• Hypertension" },
            { type: "same", text: "• T2DM" },
        ]);
    });

    it("marks pure additions", () => {
        const rows = lineDiff("• Hypertension", "• Hypertension\n• AF");
        expect(rows).toEqual([
            { type: "same", text: "• Hypertension" },
            { type: "add", text: "• AF" },
        ]);
    });

    it("marks pure removals", () => {
        const rows = lineDiff("• Hypertension\n• AF", "• Hypertension");
        expect(rows).toEqual([
            { type: "same", text: "• Hypertension" },
            { type: "remove", text: "• AF" },
        ]);
    });

    it("emits removal before addition on replacement", () => {
        const rows = lineDiff("1. Book PET", "1. Book MRI");
        expect(rows).toEqual([
            { type: "remove", text: "1. Book PET" },
            { type: "add", text: "1. Book MRI" },
        ]);
    });

    it("keeps reordered lines as remove-then-add pairs", () => {
        const rows = lineDiff("1. Bloods\n2. GP review", "1. GP review\n2. Bloods");
        expect(rows).toEqual([
            { type: "remove", text: "1. Bloods" },
            { type: "remove", text: "2. GP review" },
            { type: "add", text: "1. GP review" },
            { type: "add", text: "2. Bloods" },
        ]);
    });

    it("treats an empty string as no lines", () => {
        expect(lineDiff("", "• New entry")).toEqual([{ type: "add", text: "• New entry" }]);
        expect(lineDiff("• Old entry", "")).toEqual([{ type: "remove", text: "• Old entry" }]);
        expect(lineDiff("", "")).toEqual([]);
    });

    it("handles multi-line edits", () => {
        const rows = lineDiff(
            "• Hypertension\n• T2DM\n• GORD",
            "• Hypertension\n• T2DM on metformin\n• AF\n• GORD",
        );
        expect(rows).toEqual([
            { type: "same", text: "• Hypertension" },
            { type: "remove", text: "• T2DM" },
            { type: "add", text: "• T2DM on metformin" },
            { type: "add", text: "• AF" },
            { type: "same", text: "• GORD" },
        ]);
    });
});
