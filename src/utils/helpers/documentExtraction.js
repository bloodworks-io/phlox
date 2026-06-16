import { buildApiUrl } from "./apiConfig";
import { universalFetch } from "./apiHelpers";
import {
    convertFileToDataUrl,
    extractPdfTextOrRenderForVision,
    isPdfFile,
} from "./pdfVisionHelpers";

const normalizeProcessingMode = (value) => {
    const raw = String(value || "")
        .trim()
        .toLowerCase();
    if (raw === "vision" || raw === "ocr" || raw === "auto") return raw;
    return "auto";
};

export const getDocumentProcessingPreferences = async () => {
    try {
        const [configResponse, capabilityResponse] = await Promise.all([
            universalFetch(await buildApiUrl("/api/config/global")),
            universalFetch(
                await buildApiUrl("/api/chat/vision-capability/current"),
            ),
        ]);

        if (!configResponse.ok) {
            return { mode: "auto", visionCapable: false };
        }

        const config = await configResponse.json();

        let visionCapable = Boolean(config?.VISION_MODEL_CAPABLE);
        if (capabilityResponse.ok) {
            const capability = await capabilityResponse.json();
            visionCapable = Boolean(capability?.vision_capable);
        }

        return {
            mode: normalizeProcessingMode(
                config?.DOCUMENT_IMAGE_PROCESSING_MODE,
            ),
            visionCapable,
        };
    } catch {
        return { mode: "auto", visionCapable: false };
    }
};

const buildMetadataPayload = (metadata = {}) => ({
    name: metadata?.name || null,
    gender: metadata?.gender || null,
    dob: metadata?.dob || null,
    templateKey: metadata?.templateKey || null,
});

const buildFileFormData = (file, metadata = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    if (metadata?.name) formData.append("name", metadata.name);
    if (metadata?.gender) formData.append("gender", metadata.gender);
    if (metadata?.dob) formData.append("dob", metadata.dob);
    if (metadata?.templateKey)
        formData.append("templateKey", metadata.templateKey);
    return formData;
};

export const extractFromFile = async (file, api, metadata = {}) => {
    const mime = (file?.type || "").toLowerCase();
    const filename = (file?.name || "").toLowerCase();
    const isPdf = isPdfFile(file);
    const isTextFile = mime === "text/plain" || filename.endsWith(".txt");
    const isImageFile = mime.startsWith("image/");

    if (isTextFile) {
        const extractedText = await file.text();
        return api.fromText({
            extracted_text: extractedText,
            ...buildMetadataPayload(metadata),
        });
    }

    if (isPdf || isImageFile) {
        const { mode, visionCapable } =
            await getDocumentProcessingPreferences();
        const shouldUseVision =
            mode === "vision" || (mode === "auto" && visionCapable);
        const allowOcrFallback = mode !== "vision";

        if (mode === "vision" && !visionCapable) {
            throw new Error(
                "Vision mode is enabled, but the selected endpoint/model is not marked as vision-capable.",
            );
        }

        const viaLegacyFile = () =>
            api.legacyFile(buildFileFormData(file, metadata));

        if (isPdf) {
            try {
                const pdfResult = await extractPdfTextOrRenderForVision(file, {
                    text: { maxPages: 25 },
                    render: { maxPages: 8, scale: 1.6 },
                });

                const extractedText = (pdfResult.textResult?.text || "").trim();

                if (pdfResult.strategy === "text" && extractedText) {
                    return api.fromText({
                        extracted_text: extractedText,
                        ...buildMetadataPayload(metadata),
                    });
                }

                if (!shouldUseVision) {
                    throw new Error(
                        "PDF requires visual fallback but vision mode/capability is unavailable.",
                    );
                }

                const pages = (pdfResult.imageResult?.images || []).map(
                    (img) => ({
                        page_number: img.pageNumber,
                        data_url: img.dataUrl,
                        mime_type: img.mimeType,
                        width: img.width,
                        height: img.height,
                    }),
                );

                if (!pages.length) {
                    throw new Error(
                        "No visual pages could be prepared from this PDF",
                    );
                }

                return api.visual({
                    pages,
                    filename: file?.name || "uploaded-document",
                    content_type: mime || "application/octet-stream",
                    ...buildMetadataPayload(metadata),
                });
            } catch (pdfError) {
                if (!allowOcrFallback) throw pdfError;
                return viaLegacyFile();
            }
        }

        // Image file
        if (shouldUseVision) {
            try {
                const dataUrl = await convertFileToDataUrl(file);
                const pages = [
                    {
                        page_number: 1,
                        data_url: dataUrl,
                        mime_type: mime || "image/png",
                    },
                ];
                return api.visual({
                    pages,
                    filename: file?.name || "uploaded-document",
                    content_type: mime || "application/octet-stream",
                    ...buildMetadataPayload(metadata),
                });
            } catch (visionError) {
                if (!allowOcrFallback) throw visionError;
                return viaLegacyFile();
            }
        }
        return viaLegacyFile();
    }

    return api.legacyFile(buildFileFormData(file, metadata));
};
