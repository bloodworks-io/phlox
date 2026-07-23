// Shared PDF extraction helpers used by both single-file and bulk uploaders.
import { ragApi } from "../api/ragApi";
import { chatApi } from "../api/chatApi";
import { settingsApi } from "../api/settingsApi";
import { extractPdfTextOrRenderForVision } from "./pdfVisionHelpers";

/**
 * Determine the document processing mode and vision capability from config.
 * @returns {{ mode: string, visionCapable: boolean }}
 */
async function getProcessingConfig() {
    let mode = "auto";
    let visionCapable = false;

    try {
        const cfg = await settingsApi.fetchConfig();
        if (cfg) {
            const rawMode = String(
                cfg?.DOCUMENT_IMAGE_PROCESSING_MODE || "auto",
            )
                .trim()
                .toLowerCase();
            mode =
                rawMode === "vision" ||
                rawMode === "ocr" ||
                rawMode === "auto"
                    ? rawMode
                    : "auto";

            try {
                const capability =
                    await chatApi.getCurrentVisionCapability();
                visionCapable = Boolean(capability?.vision_capable);
            } catch (capabilityError) {
                console.warn(
                    "Could not load cached current vision capability, falling back to legacy flag:",
                    capabilityError,
                );
                visionCapable = Boolean(cfg?.VISION_MODEL_CAPABLE);
            }
        }
    } catch (configError) {
        console.warn(
            "Could not load processing mode config, defaulting to auto:",
            configError,
        );
    }

    return { mode, visionCapable };
}

/**
 * Extract text from a PDF using the vision path (frontend text-first).
 * @param {File} file
 * @param {string} filename
 * @returns {Promise<string>} The extracted text.
 */
async function extractTextViaVision(file, filename) {
    const pdfResult = await extractPdfTextOrRenderForVision(file);

    let extractedText;
    if (pdfResult.strategy === "text") {
        extractedText = pdfResult.textResult?.text || "";
    } else {
        const visualResult = await chatApi.analyzeVisualDocument({
            filename,
            content_type: "application/pdf",
            strategy: "vision",
            pages: (pdfResult.imageResult?.images || []).map((img) => ({
                page_number: img.pageNumber,
                data_url: img.dataUrl,
                mime_type: img.mimeType,
                width: img.width,
                height: img.height,
            })),
            fallback_text: pdfResult.textResult?.text || "",
            extraction_info: {
                reason:
                    pdfResult.textResult?.quality?.reason ||
                    "No usable embedded PDF text",
                stats: pdfResult.textResult?.quality?.stats || {},
                page_count: pdfResult.textResult?.pageCount || 0,
                processed_pages:
                    pdfResult.textResult?.processedPages || 0,
                rendered_pages:
                    pdfResult.imageResult?.renderedPages || 0,
            },
        });

        extractedText =
            visualResult.text || pdfResult.textResult?.text || "";
    }

    if (!extractedText.trim()) {
        throw new Error(
            "Could not extract usable text from frontend visual/text-first path.",
        );
    }

    return extractedText;
}

/**
 * Extract PDF metadata (disease_name, focus_area, document_source) from a file.
 *
 * Handles both the vision path (frontend text-first) and the legacy backend
 * fallback. Returns the extracted text alongside the metadata so callers can
 * later commit without re-extracting.
 *
 * @param {File} file - The PDF file to process.
 * @returns {Promise<{ extractedText: string, disease_name: string, focus_area: string, document_source: string, filename: string }>}
 * @throws {Error} If extraction fails.
 */
export async function extractPdfMetadata(file) {
    const filename = file.name || "uploaded.pdf";

    const { mode, visionCapable } = await getProcessingConfig();

    const shouldUseVision =
        mode === "vision" || (mode === "auto" && visionCapable);
    const allowOcrFallback = mode !== "vision";

    if (mode === "vision" && !visionCapable) {
        throw new Error(
            "Vision mode is enabled, but the selected endpoint/model is not marked as vision-capable.",
        );
    }

    let extractedText;
    let metadata;

    if (shouldUseVision) {
        try {
            extractedText = await extractTextViaVision(file, filename);

            metadata = await ragApi.extractPdfInfoFromText({
                extracted_text: extractedText,
                filename,
            });
        } catch (visionPathError) {
            if (!allowOcrFallback) {
                throw visionPathError;
            }

            console.warn(
                "Vision path unavailable; falling back to backend OCR/PDF extraction:",
                visionPathError,
            );
            const formData = new FormData();
            formData.append("file", file);
            metadata = await ragApi.extractPdfInfo(formData);
            // Backend path doesn't return extracted text — we won't have it for direct commit.
            // In this case the caller should fall back to the two-step staging flow.
            extractedText = null;
        }
    } else {
        const formData = new FormData();
        formData.append("file", file);
        metadata = await ragApi.extractPdfInfo(formData);
        extractedText = null;
    }

    // Read raw file bytes as base64 for PDF storage
    let pdfBase64 = null;
    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfBase64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                "",
            ),
        );
    } catch (e) {
        console.warn("Could not read PDF bytes for storage:", e);
    }

    return {
        extractedText,
        pdfBase64,
        disease_name: metadata.disease_name,
        focus_area: metadata.focus_area,
        document_source: metadata.document_source,
        title: metadata.title,
        filename,
    };
}
