import { describe, expect, it } from "vitest";
import { typography } from "./typography";

describe("Clinical Folio typography foundation", () => {
    it("uses Public Sans for body and normal headings", () => {
        expect(typography.fonts.body).toBe('"Public Sans", system-ui, sans-serif');
        expect(typography.fonts.heading).toBe('"Public Sans", system-ui, sans-serif');
    });

    it("exposes Source Serif as a separate display role", () => {
        expect(typography.fonts.display).toBe('"Source Serif 4", Georgia, serif');
    });

    it("keeps global heading styles sans-serif", () => {
        for (const [level, style] of Object.entries(typography.styles)) {
            expect(style.fontFamily).toBe('"Public Sans", system-ui, sans-serif');
            expect(style.fontFamily).not.toContain("Source Serif");
            expect(level).toMatch(/^h[1-7]$/);
        }
    });
});
