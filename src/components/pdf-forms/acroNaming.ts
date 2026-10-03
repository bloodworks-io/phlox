import type { FormField } from "./types";

/** [x1, y1, x2, y2] in PDF points (origin bottom-left). */
export type PdfRect = [number, number, number, number];

/** Minimal shape of a pdf.js widget annotation we consume. */
export interface AcroWidget {
    fieldName?: string | null;
    alternativeText?: string | null;
    rect: PdfRect;
}

/** Minimal shape of a pdf.js getTextContent() item we consume. */
export interface TextItem {
    str: string;
    width: number;
    height: number;
    /** [a, b, c, d, e, f] — e/f are the baseline x/y in PDF points. */
    transform: [number, number, number, number, number, number];
}

// Auto-generated names from common PDF exporters: "Text1", "checkbox 12",
// "Check Box 3", "Untitled", "TextField", …
const JUNK_NAME_RE =
    /^(?:untitled|text(?: ?field)?|check ?box|checkbox|radio|field|form)\s*\d*$/i;

/** True when an internal field name is machine junk not worth keeping. */
export function isJunkFieldName(name: string | null | undefined): boolean {
    if (!name) return true;
    const n = name.trim();
    if (!n) return true;
    // Fully-qualified hierarchical names ("parent.child[0].f1", "Row[2]#0")
    if (/[.[#]/.test(n)) return true;
    return JUNK_NAME_RE.test(n);
}

// Symbol-font PDFs extract as private-use glyphs
const NON_TEXT_RE =
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060\uFEFF\uE000-\uF8FF]/g;

function cleanLabel(raw: string): string {
    const stripped = raw.replace(NON_TEXT_RE, " ");
    return stripped.replace(/\s+/g, " ").replace(/[:;]\s*$/, "").trim();
}

interface ItemSpan {
    item: TextItem;
    x1: number;
    x2: number;
    baseline: number;
    centerY: number;
    centerX: number;
    height: number;
}

function toSpan(item: TextItem): ItemSpan {
    const x = item.transform[4];
    const y = item.transform[5];
    return {
        item,
        x1: x,
        x2: x + item.width,
        baseline: y,
        centerY: y + item.height * 0.3,
        centerX: x + item.width / 2,
        height: item.height,
    };
}

function insideRect(span: ItemSpan, rect: PdfRect): boolean {
    return (
        span.x1 >= rect[0] - 1 &&
        span.x2 <= rect[2] + 1 &&
        span.centerY >= rect[1] - 1 &&
        span.centerY <= rect[3] + 1
    );
}

const MAX_LABEL_LENGTH = 60;
const MAX_LEFT_GAP = 80; // pt between label's right edge and the widget
const MAX_ABOVE_GAP = 24; // pt between label's baseline and the widget top
const LINE_TOLERANCE = 3; // pt slack for "same line" vertical matching

/**
 * Find the printed label for a widget: text on the same line immediately
 * to the left (the common "Label: [box]" layout), falling back to text
 * just above the box (common for full-width boxes). Returns null when no
 * plausible label exists. Text inside a sibling widget's rect is ignored
 * so neighbouring fields' content isn't harvested. Nice kludge by GLM!
 */
export function harvestWidgetLabel(
    rect: PdfRect,
    items: TextItem[],
    siblingRects: PdfRect[] = [],
): string | null {
    const candidates = items
        .filter(
            (it) =>
                typeof it.str === "string" &&
                it.str.trim().length > 0 &&
                it.str.trim().length <= MAX_LABEL_LENGTH,
        )
        .map(toSpan)
        .filter((span) => !siblingRects.some((s) => insideRect(span, s)));
    if (candidates.length === 0) return null;

    const [wx1, wy1, wx2, wy2] = rect;
    const wCenterY = (wy1 + wy2) / 2;

    // --- Same line, to the left of the widget ---
    const sameLine = candidates
        .map((span) => ({ span, gap: wx1 - span.x2 }))
        .filter(
            ({ span, gap }) =>
                gap >= -4 &&
                gap <= MAX_LEFT_GAP &&
                Math.abs(span.centerY - wCenterY) <=
                    (wy2 - wy1) / 2 + span.height + LINE_TOLERANCE,
        );

    if (sameLine.length > 0) {
        // Prefer ":"-terminated text (a strong label signal), then closest.
        sameLine.sort((a, b) => {
            const aColon = a.span.item.str.trim().endsWith(":") ? 0 : 1;
            const bColon = b.span.item.str.trim().endsWith(":") ? 0 : 1;
            return aColon - bColon || a.gap - b.gap;
        });
        // Grow leftwards over contiguous items (labels split into runs).
        const parts = [sameLine[0].span.item.str];
        let leftEdge = sameLine[0].span.x1;
        const rest = sameLine.slice(1).sort((a, b) => b.span.x2 - a.span.x2);
        for (const cand of rest) {
            if (leftEdge - cand.span.x2 <= 3) {
                parts.unshift(cand.span.item.str);
                leftEdge = cand.span.x1;
            }
        }
        const label = cleanLabel(parts.join(" "));
        if (label) return label;
    }

    // --- Just above the widget (full-width boxes) ---
    const above = candidates
        .map((span) => ({ span, gap: span.baseline - wy2 }))
        .filter(
            ({ span, gap }) =>
                gap >= 0 &&
                gap <= MAX_ABOVE_GAP &&
                span.centerX >= wx1 &&
                span.centerX <= wx2,
        )
        .sort((a, b) => a.gap - b.gap);

    if (above.length > 0) {
        const label = cleanLabel(above[0].span.item.str);
        if (label) return label;
    }

    return null;
}

/**
 * Derive a human-readable name for an AcroForm widget, in order:
 * tooltip (/TU) → printed label next to the widget → the internal
 * field name when it isn't junk → "" (user names it in the editor).
 */
export function deriveAcroFieldName(
    widget: AcroWidget,
    textItems: TextItem[],
    siblingRects: PdfRect[] = [],
): string {
    const tooltip = cleanLabel(widget.alternativeText || "");
    if (tooltip) return tooltip;

    const harvested = harvestWidgetLabel(widget.rect, textItems, siblingRects);
    if (harvested) return harvested;

    if (!isJunkFieldName(widget.fieldName)) {
        return (widget.fieldName || "").replace(/\s+/g, " ").trim();
    }

    return "";
}

/**
 * Make field names unique (names are the fill key for the LLM and the
 * fill modal). The first occurrence is kept; later ones get " (2)",
 * " (3)", … Empty names are left alone (rendered as "unnamed field").
 */
export function dedupeFieldNames<T extends Pick<FormField, "name">>(
    fields: T[],
): T[] {
    const seen = new Map<string, number>();
    return fields.map((field) => {
        if (!field.name) return field;
        const count = seen.get(field.name) ?? 0;
        seen.set(field.name, count + 1);
        if (count === 0) return field;
        return { ...field, name: `${field.name} (${count + 1})` };
    });
}
