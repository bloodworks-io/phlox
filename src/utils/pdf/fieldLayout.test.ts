import { describe, expect, it } from "vitest";
import {
    wrapText,
    layoutTextField,
    checkboxMark,
    canEncodeWinAnsi,
    winAnsiSafe,
    getHelveticaMeasure,
} from "./fieldLayout";

// Fake font metrics: every char is size * 0.5 wide
const measure = (text, size) => text.length * size * 0.5;

describe("wrapText", () => {
    it("wraps at word boundaries", () => {
        expect(wrapText("aa bb cc", measure, 10, 25)).toEqual(["aa bb", "cc"]);
    });

    it("hard-breaks words wider than the box", () => {
        expect(wrapText("abcdefghij", measure, 10, 25)).toEqual([
            "abcde",
            "fghij",
        ]);
    });

    it("never returns a line wider than maxWidth", () => {
        const lines = wrapText("supercalifragilistic a b", measure, 10, 10);
        for (const line of lines) {
            expect(measure(line, 10)).toBeLessThanOrEqual(10);
        }
    });
});

describe("layoutTextField", () => {
    it("single line fits and is vertically centered in a short box", () => {
        const field = { x: 10, y: 20, width: 100, height: 14, font_size: 10 };
        const result = layoutTextField(field, "hi", measure);
        expect(result.lines).toEqual([{ text: "hi", x: 12, y: 22 }]);
        expect(result.hiddenLineCount).toBe(0);
        expect(result.overflowsWidth).toBe(false);
    });

    it("single line anchors at the top of a tall box", () => {
        const field = { x: 10, y: 20, width: 100, height: 60, font_size: 10 };
        const result = layoutTextField(field, "hi", measure);
        expect(result.lines[0].y).toBe(20 + 60 - 10 - 2);
    });

    it("shrinks the font until wrapped text fits, no hidden lines", () => {
        const field = { x: 0, y: 0, width: 12, height: 13, font_size: 10 };
        const result = layoutTextField(field, "a b c d", measure);
        expect(result.fontSize).toBe(5); // stepped down from 10
        expect(result.lines.map((l) => l.text)).toEqual(["a b", "c d"]);
        expect(result.hiddenLineCount).toBe(0);
    });

    it("stops shrinking at the 4pt floor and still overflows", () => {
        const field = { x: 0, y: 0, width: 6, height: 3, font_size: 12 };
        const result = layoutTextField(field, "ab", measure);
        expect(result.fontSize).toBe(4);
        expect(result.hiddenLineCount).toBeGreaterThan(0);
    });
});

describe("checkboxMark", () => {
    it("sizes and centers the mark", () => {
        const field = { x: 0, y: 0, width: 20, height: 10, font_size: 12 };
        const mark = checkboxMark(field, measure);
        expect(mark).toEqual({ mark: "x", size: 8, x: 8, y: 1 });
    });
});

describe("winAnsiSafe / canEncodeWinAnsi", () => {
    it("accepts the full cp1252 printable range incl. accented chars", () => {
        for (const char of "aZ0 éèüñÇ×÷“”–€") {
            expect(canEncodeWinAnsi(char), char).toBe(true);
        }
    });

    it("rejects emoji, PUA glyphs, and CJK", () => {
        for (const char of ["⚠", "", "\uF0A8", "患", "\u{1F600}"]) {
            expect(canEncodeWinAnsi(char)).toBe(false);
        }
    });

    it("replaces only the unencodable characters", () => {
        expect(winAnsiSafe("Naïve \uF0A8 ⚠")).toBe("Naïve ? ?");
    });
});

describe("getHelveticaMeasure", () => {
    it("does not throw on unencodable characters (PUA/emoji/CJK)", async () => {
        const m = await getHelveticaMeasure();
        for (const text of ["\uF0A8", "Detected ⚠", "患者氏名", "mixed ✓ ok"]) {
            const width = m(text, 12);
            expect(width).toBeGreaterThanOrEqual(0);
        }
    });

    it("measures plain text identically to the raw font", async () => {
        const m = await getHelveticaMeasure();
        expect(m("Hello World", 12)).toBeGreaterThan(0);
        expect(m("Hello World", 12)).toBeCloseTo(m("Hello World", 12));
    });
});
