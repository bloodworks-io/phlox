import { describe, it, expect } from "vitest";
import type { FieldType, FormField } from "./types";
import {
    DEFAULT_PAGE_HEIGHT,
    FIELD_CANVAS_COLORS,
    HANDLE_SIZE,
    MIN_FIELD_SIZE,
    OVERFLOW_COLOR,
    canvasToPdf,
    createFieldDraft,
    drawFieldOverlays,
    fieldToCanvas,
    findFieldAtPos,
    getPageHeight,
    isOnResizeHandle,
    normalizeRect,
} from "./formBuilderUtils";

const COORD = { pageHeights: [792, 612], currentPage: 1, renderScale: 2 };

const field = (overrides: Partial<FormField> = {}): FormField => ({
    id: "f1",
    name: "Field One",
    description: "",
    field_type: "text",
    required: false,
    page_number: 1,
    x: 100,
    y: 400,
    width: 80,
    height: 20,
    font_size: 12,
    ...overrides,
});

describe("getPageHeight", () => {
    it("indexes per page and falls back to US-Letter", () => {
        expect(getPageHeight([792, 612], 1)).toBe(792);
        expect(getPageHeight([792, 612], 2)).toBe(612);
        expect(getPageHeight([], 1)).toBe(DEFAULT_PAGE_HEIGHT);
        expect(DEFAULT_PAGE_HEIGHT).toBe(792);
    });
});

describe("coordinate conversion", () => {
    it("flips the y-axis from PDF (bottom-left) to canvas (top-left)", () => {
        const rect = fieldToCanvas(field(), COORD);
        expect(rect).toEqual({
            x: 200,
            y: (792 - 400 - 20) * 2,
            width: 160,
            height: 40,
        });
    });

    it("round-trips fieldToCanvas through canvasToPdf", () => {
        const f = field();
        const canvas = fieldToCanvas(f, COORD);
        const back = canvasToPdf(
            canvas.x,
            canvas.y,
            canvas.width,
            canvas.height,
            COORD,
        );
        expect(back.x).toBeCloseTo(f.x);
        expect(back.y).toBeCloseTo(f.y);
        expect(back.width).toBeCloseTo(f.width);
        expect(back.height).toBeCloseTo(f.height);
    });

    it("uses the height of the current page only", () => {
        const rect = fieldToCanvas(
            field({ page_number: 2 }),
            { ...COORD, currentPage: 2 },
        );
        expect(rect.y).toBeCloseTo((612 - 400 - 20) * 2);
    });
});

describe("findFieldAtPos", () => {
    const a = field({ id: "a", y: 700 }); // near the top of the page
    const b = field({ id: "b", x: 100, y: 700 }); // overlaps a, later in array
    const otherPage = field({ id: "c", page_number: 2 });

    it("returns the topmost (last) overlapping field", () => {
        const hit = findFieldAtPos([a, b], 250, 150, COORD);
        expect(hit?.id).toBe("b");
    });

    it("ignores fields on other pages", () => {
        expect(findFieldAtPos([otherPage], 200, 150, COORD)).toBeNull();
    });

    it("returns null when nothing is under the point", () => {
        expect(findFieldAtPos([a], 5, 5, COORD)).toBeNull();
    });
});

describe("isOnResizeHandle", () => {
    const f = field({ id: "sel" });
    const fields = [f];
    const coord = COORD;

    it("is true only inside the handle square at the field's lower-right", () => {
        const rect = fieldToCanvas(f, coord);
        const hx = rect.x + rect.width - HANDLE_SIZE;
        const hy = rect.y + rect.height - HANDLE_SIZE;
        expect(isOnResizeHandle(fields, "sel", hx, hy, coord)).toBe(true);
        expect(isOnResizeHandle(fields, "sel", hx + 1, hy + 1, coord)).toBe(
            true,
        );
        expect(isOnResizeHandle(fields, "sel", hx - 1, hy, coord)).toBe(false);
        expect(isOnResizeHandle(fields, "sel", rect.x, rect.y, coord)).toBe(
            false,
        );
    });

    it("requires a selection and a selected field on the current page", () => {
        expect(isOnResizeHandle(fields, null, 0, 0, coord)).toBe(false);
        const elsewhere = field({ id: "sel", page_number: 2 });
        expect(
            isOnResizeHandle([elsewhere], "sel", 0, 0, coord),
        ).toBe(false);
    });
});

describe("normalizeRect", () => {
    it("normalizes drags in any direction", () => {
        expect(normalizeRect({ x: 10, y: 10 }, { x: 50, y: 40 })).toEqual({
            x: 10,
            y: 10,
            width: 40,
            height: 30,
        });
        expect(normalizeRect({ x: 50, y: 40 }, { x: 10, y: 10 })).toEqual({
            x: 10,
            y: 10,
            width: 40,
            height: 30,
        });
    });
});

describe("createFieldDraft", () => {
    it("creates a draft with defaults and a generated id", () => {
        const draft = createFieldDraft(
            { x: 10, y: 20, width: 30, height: 40 },
            "date",
            2,
        );
        expect(draft.id).toMatch(/^field_\d+_[a-z0-9]{6}$/);
        expect(draft).toMatchObject({
            name: "",
            description: "",
            field_type: "date",
            required: false,
            page_number: 2,
            x: 10,
            y: 20,
            width: 30,
            height: 40,
            font_size: 12,
        });
    });
});

describe("drawFieldOverlays", () => {
    function makeMockCtx(width = 600, height = 800) {
        const ops = [];
        const ctx = {
            canvas: { width, height },
            clearRect: (...args) => ops.push({ op: "clearRect", args }),
            strokeRect: (...args) =>
                ops.push({
                    op: "strokeRect",
                    args,
                    strokeStyle: ctx.strokeStyle,
                    lineWidth: ctx.lineWidth,
                }),
            fillRect: (...args) =>
                ops.push({ op: "fillRect", args, fillStyle: ctx.fillStyle }),
            fillText: (...args) =>
                ops.push({
                    op: "fillText",
                    args,
                    fillStyle: ctx.fillStyle,
                    font: ctx.font,
                }),
            setLineDash: (...args) => ops.push({ op: "setLineDash", args }),
            strokeStyle: null,
            fillStyle: null,
            lineWidth: null,
            font: null,
            textBaseline: null,
        };
        return {
            ctx: ctx as unknown as CanvasRenderingContext2D,
            ops,
        };
    }

    const coord = { pageHeights: [792], currentPage: 1, renderScale: 1 };

    it("clears the canvas and strokes one rect per page field with type colors", () => {
        const { ctx, ops } = makeMockCtx();
        drawFieldOverlays(ctx, {
            fields: [
                field({ id: "a", name: "A" }),
                field({ id: "b", name: "B", field_type: "checkbox" }),
                field({ id: "c", name: "C", page_number: 2 }),
            ],
            coord,
            selectedFieldId: null,
            previewOn: false,
            previewValues: {},
            measure: null,
        });
        expect(ops[0].op).toBe("clearRect");
        const strokes = ops.filter((o) => o.op === "strokeRect");
        expect(strokes).toHaveLength(2); // page-2 field is skipped
        expect(strokes[0].strokeStyle).toBe(FIELD_CANVAS_COLORS.text.stroke);
        expect(strokes[1].strokeStyle).toBe(FIELD_CANVAS_COLORS.checkbox.stroke);
        expect(strokes.every((s) => s.lineWidth === 1.5)).toBe(true);
    });

    it("highlights the selected field and draws its resize handle", () => {
        const { ctx, ops } = makeMockCtx();
        drawFieldOverlays(ctx, {
            fields: [field({ id: "a", name: "A" })],
            coord,
            selectedFieldId: "a",
            previewOn: false,
            previewValues: {},
            measure: null,
        });
        const strokes = ops.filter((o) => o.op === "strokeRect");
        expect(strokes[0].lineWidth).toBe(3);
        const rect = fieldToCanvas(field(), coord);
        const handle = ops.find(
            (o) =>
                o.op === "fillRect" &&
                o.args[0] === rect.x + rect.width - HANDLE_SIZE &&
                o.args[1] === rect.y + rect.height - HANDLE_SIZE,
        );
        expect(handle).toBeTruthy();
        expect(handle.fillStyle).toBe(FIELD_CANVAS_COLORS.text.stroke);
    });

    it("marks overflow with the warning color and a ⚠ label suffix", () => {
        const { ctx, ops } = makeMockCtx();
        // Measure that reports every text as wider than the box forces overflow.
        const overflowingMeasure = () => 100000;
        drawFieldOverlays(ctx, {
            fields: [field({ id: "a", name: "A" })],
            coord,
            selectedFieldId: "a",
            previewOn: true,
            previewValues: {},
            measure: overflowingMeasure,
        });
        const strokes = ops.filter((o) => o.op === "strokeRect");
        expect(strokes[0].strokeStyle).toBe(OVERFLOW_COLOR);
        const label = ops.find((o) => o.op === "fillText" && o.args[0] === "A ⚠");
        expect(label).toBeTruthy();
        expect(label.fillStyle).toBe(OVERFLOW_COLOR);
    });

    it("draws no preview and no handle when nothing is selected and preview is off", () => {
        const { ctx, ops } = makeMockCtx();
        const measure = (text) => text.length * 5;
        drawFieldOverlays(ctx, {
            fields: [field({ id: "a", name: "A" })],
            coord,
            selectedFieldId: null,
            previewOn: false,
            previewValues: { a: "hello" },
            measure,
        });
        // Only the name label is drawn — no preview lines for the value.
        expect(
            ops.filter((o) => o.op === "fillText").map((o) => o.args[0]),
        ).toEqual(["A"]);
        expect(ops.filter((o) => o.op === "fillRect")).toHaveLength(1); // rect fill only
    });

    it("falls back to text colors for unknown field types", () => {
        const { ctx, ops } = makeMockCtx();
        drawFieldOverlays(ctx, {
            fields: [
                field({ id: "a", name: "A", field_type: "weird" as FieldType }),
            ],
            coord,
            selectedFieldId: null,
            previewOn: false,
            previewValues: {},
            measure: null,
        });
        expect(ops.find((o) => o.op === "strokeRect").strokeStyle).toBe(
            FIELD_CANVAS_COLORS.text.stroke,
        );
    });
});

describe("constants", () => {
    it("MIN_FIELD_SIZE is the drawn/kept minimum", () => {
        expect(MIN_FIELD_SIZE).toBe(10);
    });
});
