import { settingsApi } from "../api/settingsApi";
import { chatApi } from "../api/chatApi";
import {
  convertFileToDataUrl,
  extractPdfText,
  isPdfFile,
  renderPdfPagesToImages,
} from "./pdfVisionHelpers";

const normalizeProcessingMode = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "vision" || raw === "ocr" || raw === "auto") return raw;
  return "auto";
};

export const getDocumentProcessingPreferences = async () => {
  let mode = "auto";
  let visionCapable = false;

  try {
    const config = await settingsApi.fetchConfig();
    if (config) {
      mode = normalizeProcessingMode(config?.DOCUMENT_IMAGE_PROCESSING_MODE);
      visionCapable = Boolean(config?.VISION_MODEL_CAPABLE);
    }
  } catch {
    // keep defaults
  }

  try {
    const capability = await chatApi.getCurrentVisionCapability();
    visionCapable = Boolean(capability?.vision_capable);
  } catch {
    // keep whatever we got from config
  }

  return { mode, visionCapable };
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
    const { mode, visionCapable } = await getDocumentProcessingPreferences();
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
      // Step 1: try text-layer extraction.
      let textResult = null;
      let textFailed = false;
      try {
        textResult = await extractPdfText(file, { maxPages: 25 });
      } catch {
        textFailed = true;
      }

      const extractedText = (textResult?.text || "").trim();

      // Good text layer → use it directly.
      if (!textFailed && textResult?.quality?.usable && extractedText) {
        return api.fromText({
          extracted_text: extractedText,
          ...buildMetadataPayload(metadata),
        });
      }

      // No usable text layer (empty, low-quality, or extraction threw).
      // Only vision can read such a PDF; the legacy text-only backend path
      // (pypdf) cannot, except possibly when pdfjs itself crashed on open —
      // in which case the backend parser is worth a shot as a last resort.
      if (!shouldUseVision) {
        if (textFailed && allowOcrFallback) {
          return viaLegacyFile();
        }
        throw new Error(
          "This PDF has no selectable text layer, so vision is required to read it, " +
            "but the current model is not vision-capable.",
        );
      }

      // Step 2: render pages to images for the vision model.
      let imageResult;
      try {
        imageResult = await renderPdfPagesToImages(file, {
          maxPages: 8,
          scale: 1.6,
        });
      } catch (renderError) {
        // Both pdfjs paths failed. As an absolute last resort, try the
        // backend pypdf parser (different implementation).
        if (textFailed && allowOcrFallback) {
          return viaLegacyFile();
        }
        throw new Error(
          "This PDF has no selectable text layer and its pages couldn't be " +
            `rendered for vision: ${renderError?.message || renderError}`,
          { cause: renderError },
        );
      }

      const pages = (imageResult?.images || []).map((img) => ({
        page_number: img.pageNumber,
        data_url: img.dataUrl,
        mime_type: img.mimeType,
        width: img.width,
        height: img.height,
      }));

      if (!pages.length) {
        throw new Error("No visual pages could be prepared from this PDF");
      }

      // Vision path — let any error propagate (the legacy text path can't process images).
      return api.visual({
        pages,
        filename: file?.name || "uploaded-document",
        content_type: mime || "application/octet-stream",
        ...buildMetadataPayload(metadata),
      });
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
