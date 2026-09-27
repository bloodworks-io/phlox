import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { layoutTextField, checkboxMark } from "./fieldLayout";

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
 * Layout comes from fieldLayout.ts — shared with the editor preview.
 */
function drawTextInField(page, field, value, font) {
    const measure = (text, size) => font.widthOfTextAtSize(text, size);
    const { lines, fontSize } = layoutTextField(field, value, measure);
    for (const line of lines) {
        page.drawText(line.text, {
            x: line.x,
            y: line.y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
        });
    }
}

/**
 * Draw a centered checkmark in a checkbox field.
 */
function drawCheckmark(page, field, font) {
    const { mark, size, x, y } = checkboxMark(
        field,
        (text, s) => font.widthOfTextAtSize(text, s),
    );
    page.drawText(mark, {
        x,
        y,
        size,
        font,
        color: rgb(0, 0, 0),
    });
}
