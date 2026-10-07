import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { fillPdf } from "./fillForm";

async function makeTemplatePdf() {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    return doc.save();
}

const TEMPLATE = {
    id: "tpl-1",
    fields: [
        {
            id: "f1",
            name: "Patient Name",
            field_type: "text",
            page_number: 1,
            x: 100,
            y: 600,
            width: 200,
            height: 16,
            font_size: 12,
        },
        {
            id: "f2",
            name: "Consent",
            field_type: "checkbox",
            page_number: 1,
            x: 100,
            y: 500,
            width: 14,
            height: 14,
            font_size: 12,
        },
    ],
};

describe("fillPdf", () => {
    it("fills text and checkbox fields without throwing", async () => {
        const bytes = await makeTemplatePdf();
        const filled = await fillPdf(new Uint8Array(bytes), TEMPLATE, {
            "Patient Name": "Ada Lovelace",
            Consent: "true",
        });
        expect(filled).toBeInstanceOf(Uint8Array);
        expect(filled.length).toBeGreaterThan(bytes.length);
    });

    it("replaces unencodable characters (PUA/emoji) instead of throwing", async () => {
        const bytes = await makeTemplatePdf();
        // Regression: pdf-lib throws `WinAnsi cannot encode` on such values.
        const filled = await fillPdf(new Uint8Array(bytes), TEMPLATE, {
            "Patient Name": "Symptômes \uF0A8 ⚠ sévères",
        });
        expect(filled).toBeInstanceOf(Uint8Array);
    });

    it("skips empty and missing values", async () => {
        const bytes = await makeTemplatePdf();
        const filled = await fillPdf(new Uint8Array(bytes), TEMPLATE, {
            "Patient Name": "",
            Consent: undefined,
        });
        expect(filled).toBeInstanceOf(Uint8Array);
    });
});
