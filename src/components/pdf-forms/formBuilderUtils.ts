import { layoutTextField, checkboxMark } from "../../utils/pdf/fieldLayout";
import type { FieldType, FormField } from "./types";

export type Measure = (text: string, size: number) => number;

export interface CanvasRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Everything the coordinate math needs to know about the current view. */
export interface CoordContext {
    pageHeights: number[];
    currentPage: number;
    renderScale: number;
}

// US-Letter default height (points) when a template lacks page_heights.
export const DEFAULT_PAGE_HEIGHT = 792;

// Size of the resize handle square on the selected field (canvas px).
export const HANDLE_SIZE = 6;

// Minimum drawn/kept field size (canvas px for drawing, PDF pt for resize clamp).
export const MIN_FIELD_SIZE = 10;

// Canvas-safe overflow warning color (matches Chakra red-ish used elsewhere)
export const OVERFLOW_COLOR = "#e53e3e";

// Canvas-safe colors mapped from field types (can't use Chakra tokens in canvas)
export const FIELD_CANVAS_COLORS: Record<
    FieldType,
    { stroke: string; fill: string; fillSelected: string }
> = {
    text: {
        stroke: "#3182ce",
        fill: "rgba(49,130,206,0.1)",
        fillSelected: "rgba(49,130,206,0.2)",
    },
    checkbox: {
        stroke: "#38a169",
        fill: "rgba(56,161,105,0.1)",
        fillSelected: "rgba(56,161,105,0.2)",
    },
    date: {
        stroke: "#dd6b20",
        fill: "rgba(221,107,32,0.1)",
        fillSelected: "rgba(221,107,32,0.2)",
    },
    number: {
        stroke: "#805ad5",
        fill: "rgba(128,90,213,0.1)",
        fillSelected: "rgba(128,90,213,0.2)",
    },
};

export function getPageHeight(pageHeights: number[], page: number): number {
    return pageHeights[page - 1] || DEFAULT_PAGE_HEIGHT;
}

/** Convert a field's PDF-space rect (origin bottom-left) to canvas space. */
export function fieldToCanvas(
    field: Pick<FormField, "x" | "y" | "width" | "height">,
    coord: CoordContext,
): CanvasRect {
    const pageHeight = getPageHeight(coord.pageHeights, coord.currentPage);
    return {
        x: field.x * coord.renderScale,
        y: (pageHeight - field.y - field.height) * coord.renderScale,
        width: field.width * coord.renderScale,
        height: field.height * coord.renderScale,
    };
}

/** Convert a canvas-space rect to PDF space (origin bottom-left). */
export function canvasToPdf(
    canvasX: number,
    canvasY: number,
    canvasW: number,
    canvasH: number,
    coord: CoordContext,
): CanvasRect {
    const pageHeight = getPageHeight(coord.pageHeights, coord.currentPage);
    return {
        x: canvasX / coord.renderScale,
        y: pageHeight - (canvasY + canvasH) / coord.renderScale,
        width: canvasW / coord.renderScale,
        height: canvasH / coord.renderScale,
    };
}

/** Topmost field (last in array) under the canvas point, or null. */
export function findFieldAtPos(
    fields: FormField[],
    canvasX: number,
    canvasY: number,
    coord: CoordContext,
): FormField | null {
    const pageFields = fields.filter(
        (f) => f.page_number === coord.currentPage,
    );
    for (let i = pageFields.length - 1; i >= 0; i--) {
        const field = pageFields[i];
        const rect = fieldToCanvas(field, coord);
        if (
            canvasX >= rect.x &&
            canvasX <= rect.x + rect.width &&
            canvasY >= rect.y &&
            canvasY <= rect.y + rect.height
        ) {
            return field;
        }
    }
    return null;
}

/** True when the canvas point is on the selected field's resize handle. */
export function isOnResizeHandle(
    fields: FormField[],
    selectedFieldId: string | null,
    canvasX: number,
    canvasY: number,
    coord: CoordContext,
): boolean {
    if (!selectedFieldId) return false;
    const field = fields.find(
        (f) => f.id === selectedFieldId && f.page_number === coord.currentPage,
    );
    if (!field) return false;
    const rect = fieldToCanvas(field, coord);
    const hx = rect.x + rect.width - HANDLE_SIZE;
    const hy = rect.y + rect.height - HANDLE_SIZE;
    return (
        canvasX >= hx &&
        canvasX <= hx + HANDLE_SIZE &&
        canvasY >= hy &&
        canvasY <= hy + HANDLE_SIZE
    );
}

/** Normalize a drag (any corner direction) into a positive rect. */
export function normalizeRect(
    start: { x: number; y: number },
    end: { x: number; y: number },
): CanvasRect {
    return {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
    };
}

/** Create a new field definition from a PDF-space rect (drawn on canvas). */
export function createFieldDraft(
    pdfRect: CanvasRect,
    fieldType: FieldType,
    pageNumber: number,
): FormField {
    return {
        id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: "",
        description: "",
        field_type: fieldType,
        required: false,
        page_number: pageNumber,
        x: pdfRect.x,
        y: pdfRect.y,
        width: pdfRect.width,
        height: pdfRect.height,
        font_size: 12,
    };
}

interface CheckboxPreview {
    mark: string;
    size: number;
    x: number;
    y: number;
}

interface TextPreview {
    fontSize: number;
    lines: { text: string; x: number; y: number }[];
    hiddenLineCount: number;
    overflowsWidth: boolean;
}

/** Draw every field of the current page onto the overlay canvas. */
export function drawFieldOverlays(
    ctx: CanvasRenderingContext2D,
    params: {
        fields: FormField[];
        coord: CoordContext;
        selectedFieldId: string | null;
        previewOn: boolean;
        previewValues: Record<string, string>;
        measure: Measure | null;
    },
): void {
    const { fields, coord, selectedFieldId, previewOn, previewValues, measure } =
        params;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const pageHeight = getPageHeight(coord.pageHeights, coord.currentPage);
    const pageFields = fields.filter(
        (f) => f.page_number === coord.currentPage,
    );
    for (const field of pageFields) {
        const rect = fieldToCanvas(field, coord);
        const colors =
            FIELD_CANVAS_COLORS[field.field_type] || FIELD_CANVAS_COLORS.text;

        // WYSIWYG preview: same layout math fillPdf uses
        const wantsPreview = previewOn || field.id === selectedFieldId;
        const sample = previewValues[field.id] ?? field.name ?? "";
        let checkboxPreview: CheckboxPreview | null = null;
        let textPreview: TextPreview | null = null;
        let overflow = false;
        if (measure && wantsPreview) {
            if (field.field_type === "checkbox") {
                checkboxPreview = checkboxMark(field, measure);
            } else if (sample.trim()) {
                const layout = layoutTextField(field, sample, measure);
                textPreview = layout;
                overflow =
                    layout.hiddenLineCount > 0 || layout.overflowsWidth;
            }
        }

        ctx.strokeStyle = overflow ? OVERFLOW_COLOR : colors.stroke;
        ctx.lineWidth = field.id === selectedFieldId ? 3 : 1.5;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        ctx.fillStyle =
            field.id === selectedFieldId ? colors.fillSelected : colors.fill;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        if (field.name) {
            ctx.fillStyle = overflow ? OVERFLOW_COLOR : "rgba(0,0,0,0.7)";
            ctx.font = "10px sans-serif";
            ctx.fillText(
                overflow ? `${field.name} ⚠` : field.name,
                rect.x + 2,
                rect.y - 3,
            );
        }

        if (checkboxPreview || textPreview) {
            ctx.fillStyle = "rgba(0,0,0,0.85)";
            ctx.textBaseline = "alphabetic";
            if (checkboxPreview) {
                ctx.font = `${checkboxPreview.size * coord.renderScale}px Helvetica, Arial, sans-serif`;
                ctx.fillText(
                    checkboxPreview.mark,
                    checkboxPreview.x * coord.renderScale,
                    (pageHeight - checkboxPreview.y) * coord.renderScale,
                );
            } else if (textPreview) {
                ctx.font = `${textPreview.fontSize * coord.renderScale}px Helvetica, Arial, sans-serif`;
                for (const line of textPreview.lines) {
                    ctx.fillText(
                        line.text,
                        line.x * coord.renderScale,
                        (pageHeight - line.y) * coord.renderScale,
                    );
                }
            }
        }

        // Draw resize handle on the selected field's lower-right corner
        if (field.id === selectedFieldId) {
            ctx.fillStyle = colors.stroke;
            ctx.fillRect(
                rect.x + rect.width - HANDLE_SIZE,
                rect.y + rect.height - HANDLE_SIZE,
                HANDLE_SIZE,
                HANDLE_SIZE,
            );
        }
    }
}
