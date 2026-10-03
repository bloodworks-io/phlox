import { describe, it, expect } from "vitest";
import {
    dedupeFieldNames,
    deriveAcroFieldName,
    harvestWidgetLabel,
    isJunkFieldName,
} from "./acroNaming";

// Widget at x 400..500, vertically 100..120 (PDF points, y up).
const WIDGET: [number, number, number, number] = [400, 100, 500, 120];

/** Text item helper: baseline at (x, y), given width/height. */
const text = (
    str: string,
    x: number,
    y: number,
    width: number,
    height = 10,
) => ({
    str,
    width,
    height,
    transform: [1, 0, 0, 1, x, y] as [
        number,
        number,
        number,
        number,
        number,
        number,
    ],
});

describe("isJunkFieldName", () => {
    it("flags machine-generated names from common exporters", () => {
        for (const name of [
            "Text1",
            "Text Field 2",
            "checkbox 12",
            "Check Box 3",
            "checkbox",
            "Untitled",
            "form",
            "Field7",
            "topmostSubform[0].Page1.f1",
            "Row1[0].TextField1",
            "Row2#0",
        ]) {
            expect(isJunkFieldName(name), name).toBe(true);
        }
    });

    it("keeps human-readable names", () => {
        for (const name of [
            "Date of Birth",
            "DOB",
            "Patient Name",
            "Q2 2024 Income",
            "Insurance Provider",
        ]) {
            expect(isJunkFieldName(name), name).toBe(false);
        }
    });

    it("treats empty/missing as junk", () => {
        expect(isJunkFieldName("")).toBe(true);
        expect(isJunkFieldName(null)).toBe(true);
        expect(isJunkFieldName(undefined)).toBe(true);
        expect(isJunkFieldName("   ")).toBe(true);
    });
});

describe("harvestWidgetLabel", () => {
    it("finds the label on the same line to the left and strips the colon", () => {
        const items = [
            text("Date of Birth:", 280, 102, 115),
            text("Page header", 280, 700, 90),
        ];
        expect(harvestWidgetLabel(WIDGET, items)).toBe("Date of Birth");
    });

    it("merges contiguous label runs split across text items", () => {
        const items = [
            text("Date of", 280, 102, 45),
            text("Birth:", 327, 102, 33), // 2pt gap to the previous item
        ];
        expect(harvestWidgetLabel(WIDGET, items)).toBe("Date of Birth");
    });

    it("ignores text that is too far away or on another line", () => {
        expect(
            harvestWidgetLabel(WIDGET, [text("far away:", 100, 102, 50)]),
        ).toBeNull(); // gap 250pt > 80pt
        expect(
            harvestWidgetLabel(WIDGET, [text("other line:", 280, 300, 100)]),
        ).toBeNull(); // vertically distant
    });

    it("falls back to a centered label just above full-width boxes", () => {
        const full: [number, number, number, number] = [100, 90, 500, 110];
        const items = [
            text("Describe the symptom:", 200, 116, 180),
        ];
        expect(harvestWidgetLabel(full, items)).toBe("Describe the symptom");
    });

    it("skips text that lives inside a sibling widget's rect", () => {
        const sibling: [number, number, number, number] = [280, 99, 396, 121];
        const items = [text("other field", 285, 102, 100)];
        expect(harvestWidgetLabel(WIDGET, items, [sibling])).toBeNull();
    });

    it("strips symbol-font PUA glyphs (e.g. U+F0A8) from harvested labels", () => {
        const items = [text("\uF0A8Name:", 280, 102, 115)];
        expect(harvestWidgetLabel(WIDGET, items)).toBe("Name");
    });

    it("ignores labels made only of private-use glyphs", () => {
        const items = [text("\uF0A8\uF0A9", 280, 102, 115)];
        expect(harvestWidgetLabel(WIDGET, items)).toBeNull();
    });
});

describe("deriveAcroFieldName", () => {
    const items = [text("Date of Birth:", 280, 102, 115)];

    it("prefers the tooltip (/TU alternativeText)", () => {
        expect(
            deriveAcroFieldName(
                {
                    fieldName: "Text1",
                    alternativeText: "Patient date of birth",
                    rect: WIDGET,
                },
                items,
            ),
        ).toBe("Patient date of birth");
    });

    it("harvests the printed label when there is no tooltip", () => {
        expect(
            deriveAcroFieldName(
                { fieldName: "Text1", alternativeText: "", rect: WIDGET },
                items,
            ),
        ).toBe("Date of Birth");
    });

    it("keeps a sane internal name when nothing else is available", () => {
        expect(
            deriveAcroFieldName(
                { fieldName: "DOB", alternativeText: "", rect: WIDGET },
                [],
            ),
        ).toBe("DOB");
    });

    it("returns empty when the name is junk and no label exists", () => {
        expect(
            deriveAcroFieldName(
                { fieldName: "checkbox 2", alternativeText: "", rect: WIDGET },
                [],
            ),
        ).toBe("");
    });
});

describe("dedupeFieldNames", () => {
    it("suffixes later duplicates, keeps the first, leaves empties alone", () => {
        const fields = [
            { name: "Date" },
            { name: "Date" },
            { name: "Date" },
            { name: "" },
            { name: "" },
            { name: "Signature" },
        ];
        expect(dedupeFieldNames(fields).map((f) => f.name)).toEqual([
            "Date",
            "Date (2)",
            "Date (3)",
            "",
            "",
            "Signature",
        ]);
    });

    it("does not mutate the input", () => {
        const fields = [{ name: "A" }, { name: "A" }];
        dedupeFieldNames(fields);
        expect(fields[1].name).toBe("A");
    });
});
