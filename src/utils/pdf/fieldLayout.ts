import { PDFDocument, StandardFonts } from "pdf-lib";

/**
 * Greedy word-wrap to maxWidth using the injected measure function,
 * then hard-break any word wider than maxWidth so no line overflows.
 */
export function wrapText(text, measure, fontSize, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = "";

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = measure(testLine, fontSize);
        if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);

    const broken = [];
    for (const line of lines) {
        if (measure(line, fontSize) <= maxWidth) {
            broken.push(line);
            continue;
        }
        let chunk = "";
        for (const ch of line) {
            if (chunk && measure(chunk + ch, fontSize) > maxWidth) {
                broken.push(chunk);
                chunk = ch;
            } else {
                chunk += ch;
            }
        }
        if (chunk) broken.push(chunk);
    }
    return broken;
}

const MIN_FONT_SIZE = 4;

/**
 * Compute the exact line geometry fillPdf will draw for a text field,
 * shrinking the font size (down to a 4pt floor) until everything fits.
 * Returns PDF-space baselines (y up from page bottom), the effective
 * fontSize, and overflow info for the remaining floor case.
 */
export function layoutTextField(field, value, measure) {
    let fontSize = field.font_size || 12;
    let layout = compute(field, value, measure, fontSize);
    while (
        (layout.hiddenLineCount > 0 || layout.overflowsWidth) &&
        fontSize > MIN_FONT_SIZE
    ) {
        fontSize -= 1;
        layout = compute(field, value, measure, fontSize);
    }
    return { ...layout, fontSize };
}

function compute(field, value, measure, fontSize) {
    const maxWidth = field.width - 4;
    const lines = [];
    let hiddenLineCount = 0;

    const textWidth = measure(value, fontSize);

    if (textWidth <= maxWidth) {
        const lineHeight = fontSize * 1.2;
        // Tall boxes (2+ lines) anchor at the top like wrapped text;
        // short boxes vertically center the line.
        const y =
            field.height >= lineHeight * 2
                ? field.y + field.height - fontSize - 2
                : field.y + (field.height - fontSize) / 2;
        lines.push({ text: value, x: field.x + 2, y });
    } else {
        const wrapped = wrapText(value, measure, fontSize, maxWidth);
        const lineHeight = fontSize * 1.2;
        for (let i = 0; i < wrapped.length; i++) {
            const yPos = field.y + field.height - fontSize - i * lineHeight - 2;
            if (yPos < field.y) {
                hiddenLineCount = wrapped.length - i;
                break;
            }
            lines.push({ text: wrapped[i], x: field.x + 2, y: yPos });
        }
    }

    const overflowsWidth = lines.some(
        (l) => measure(l.text, fontSize) > maxWidth,
    );

    return { lines, hiddenLineCount, overflowsWidth };
}

/**
 * Geometry for the checkmark drawn in a checkbox field.
 * Uses "x" — WinAnsi fonts (Helvetica) cannot encode "✓" (U+2713).
 */
export function checkboxMark(field, measure) {
    const size = Math.min(field.font_size || 12, field.height * 0.8);
    const mark = "x";
    return {
        mark,
        size,
        x: field.x + (field.width - measure(mark, size)) / 2,
        y: field.y + (field.height - size) / 2,
    };
}

let measurePromise = null;

/**
 * Cached Helvetica measure function identical to the one fillPdf uses,
 * so browser-side preview metrics match the final PDF exactly.
 */
export function getHelveticaMeasure() {
    if (!measurePromise) {
        measurePromise = PDFDocument.create().then(async (doc) => {
            const font = await doc.embedFont(StandardFonts.Helvetica);
            return (text, size) => font.widthOfTextAtSize(text, size);
        });
    }
    return measurePromise;
}
