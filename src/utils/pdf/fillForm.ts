import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Fill a PDF form template with the provided values and return the completed PDF bytes.
 *
 * @param {Uint8Array} templatePdfBytes - Original PDF bytes
 * @param {Object} template - Template object with a `fields` array
 * @param {Object} values - Map of field name → string value
 * @returns {Promise<Uint8Array>} Modified PDF bytes
 */
export async function fillPdf(templatePdfBytes, template, values) {
    const pdfDoc = await PDFDocument.load(templatePdfBytes, {
        ignoreEncryption: true,
    });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const field of template.fields) {
        const value = values[field.name];
        if (
            value === undefined ||
            value === null ||
            String(value).trim() === ""
        )
            continue;

        const page = pdfDoc.getPage(field.page_number - 1); // 0-indexed

        switch (field.field_type) {
            case "text":
            case "date":
            case "number": {
                drawTextInField(page, field, String(value), font);
                break;
            }
            case "checkbox": {
                const v = String(value).toLowerCase();
                if (v === "true" || v === "1" || v === "yes") {
                    drawCheckmark(page, field, font);
                }
                break;
            }
        }
    }

    return pdfDoc.save();
}

/**
 * Draw text inside a field rectangle, with word-wrap for long text.
 */
function drawTextInField(page, field, value, font) {
    const fontSize = field.font_size || 12;
    const maxWidth = field.width - 4; // small padding

    const textWidth = font.widthOfTextAtSize(value, fontSize);

    if (textWidth <= maxWidth) {
        // Single line, vertically centered
        const yOffset = field.y + (field.height - fontSize) / 2;
        page.drawText(value, {
            x: field.x + 2,
            y: yOffset,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
        });
    } else {
        // Multi-line: word-wrap within the field
        const lines = wrapText(value, font, fontSize, maxWidth);
        const lineHeight = fontSize * 1.2;
        for (let i = 0; i < lines.length; i++) {
            const yPos = field.y + field.height - fontSize - i * lineHeight - 2;
            if (yPos < field.y) break; // don't overflow below field
            page.drawText(lines[i], {
                x: field.x + 2,
                y: yPos,
                size: fontSize,
                font,
                color: rgb(0, 0, 0),
            });
        }
    }
}

/**
 * Draw a centered checkmark in a checkbox field.
 */
function drawCheckmark(page, field, font) {
    const size = Math.min(field.font_size || 12, field.height * 0.8);
    // Use "x" — WinAnsi fonts (Helvetica) cannot encode "✓" (U+2713).
    const mark = "x";
    const xCenter =
        field.x + (field.width - font.widthOfTextAtSize(mark, size)) / 2;
    const yCenter = field.y + (field.height - size) / 2;
    page.drawText(mark, {
        x: xCenter,
        y: yCenter,
        size,
        font,
        color: rgb(0, 0, 0),
    });
}

/**
 * Word-wrap text to fit within maxWidth using font metrics.
 */
function wrapText(text, font, fontSize, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = "";

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}
