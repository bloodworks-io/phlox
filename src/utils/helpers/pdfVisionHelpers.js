import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const DEFAULT_TEXT_OPTIONS = {
    maxPages: 25,
    minTextLength: 250,
    minAlphaNumericRatio: 0.45,
    minUniqueWords: 25,
};

const DEFAULT_RENDER_OPTIONS = {
    maxPages: 6,
    scale: 1.75,
    maxDimension: 2200,
    imageType: "image/png",
    imageQuality: 0.92,
};

let pdfjsModulePromise = null;
let pdfjsWorkerConfigured = false;

async function getPdfJs() {
    if (!pdfjsModulePromise) {
        pdfjsModulePromise = import("pdfjs-dist/legacy/build/pdf");
    }

    const pdfjs = await pdfjsModulePromise;

    if (!pdfjsWorkerConfigured) {
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        pdfjsWorkerConfigured = true;
    }

    return pdfjs;
}

function normalizeText(input) {
    return String(input ?? "")
        .replace(/\u0000/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function computeAlphaNumericRatio(text) {
    if (!text) return 0;
    const alphaNum = (text.match(/[A-Za-z0-9]/g) || []).length;
    return alphaNum / text.length;
}

function countUniqueWords(text) {
    if (!text) return 0;
    const words = text
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((w) => w.length > 2);
    return new Set(words).size;
}

function isLikelyUsableText(text, options = {}) {
    const cfg = { ...DEFAULT_TEXT_OPTIONS, ...options };
    const normalized = normalizeText(text);

    if (!normalized) {
        return {
            usable: false,
            reason: "No text extracted from PDF",
            stats: {
                length: 0,
                alphaNumericRatio: 0,
                uniqueWords: 0,
            },
        };
    }

    const length = normalized.length;
    const alphaNumericRatio = computeAlphaNumericRatio(normalized);
    const uniqueWords = countUniqueWords(normalized);

    const usable =
        length >= cfg.minTextLength &&
        alphaNumericRatio >= cfg.minAlphaNumericRatio &&
        uniqueWords >= cfg.minUniqueWords;

    let reason = "Text extraction looks usable";
    if (!usable) {
        if (length < cfg.minTextLength) reason = "Extracted text is too short";
        else if (alphaNumericRatio < cfg.minAlphaNumericRatio)
            reason = "Extracted text looks noisy";
        else if (uniqueWords < cfg.minUniqueWords)
            reason = "Extracted text lacks enough lexical variety";
        else reason = "Extracted text failed quality checks";
    }

    return {
        usable,
        reason,
        stats: { length, alphaNumericRatio, uniqueWords },
    };
}

export function isPdfFile(file) {
    if (!file) return false;
    const mime = (file.type || "").toLowerCase();
    const name = (file.name || "").toLowerCase();
    return mime === "application/pdf" || name.endsWith(".pdf");
}

/**
 * Convert an uploaded file (typically image/*) to a data URL
 * suitable for multimodal/visual analysis endpoints.
 */
export async function convertFileToDataUrl(file, options = {}) {
    const cfg = {
        allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/gif"],
        ...options,
    };

    if (!file) {
        throw new Error("convertFileToDataUrl expects a file");
    }

    const mime = (file.type || "").toLowerCase();
    const normalizedName = (file.name || "").toLowerCase();

    const extensionToMime = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
    };

    const inferredMime = Object.entries(extensionToMime).find(([ext]) =>
        normalizedName.endsWith(ext),
    )?.[1];

    const effectiveMime = mime || inferredMime || "";

    if (!cfg.allowedMimeTypes.includes(effectiveMime)) {
        throw new Error(
            `Unsupported file type for data URL conversion: ${file.type || file.name || "unknown"}. Supported formats: GIF, JPG, JPEG, PNG.`,
        );
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = String(reader.result || "");
            if (!result.startsWith("data:")) {
                reject(new Error("Failed to convert file to data URL"));
                return;
            }
            resolve(result);
        };

        reader.onerror = () => {
            reject(new Error("Failed to read file for data URL conversion"));
        };

        reader.readAsDataURL(file);
    });
}

export async function extractPdfText(file, options = {}) {
    if (!isPdfFile(file)) {
        throw new Error("extractPdfText expects a PDF file");
    }

    const cfg = { ...DEFAULT_TEXT_OPTIONS, ...options };
    const pdfjs = await getPdfJs();
    const buffer = await file.arrayBuffer();

    const loadingTask = pdfjs.getDocument({
        data: buffer,
        disableWorker: false,
    });

    const doc = await loadingTask.promise;
    const pageCount = doc.numPages;
    const pagesToProcess = clamp(cfg.maxPages, 1, pageCount);

    const pageTexts = [];
    for (let i = 1; i <= pagesToProcess; i += 1) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = normalizeText(
            textContent.items.map((item) => item.str || "").join(" "),
        );
        pageTexts.push(pageText);
    }

    const text = normalizeText(pageTexts.join("\n\n"));
    const quality = isLikelyUsableText(text, cfg);

    return {
        strategy: "text",
        text,
        pageCount,
        processedPages: pagesToProcess,
        quality,
    };
}

function createCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(width));
    canvas.height = Math.max(1, Math.floor(height));
    return canvas;
}

function fitViewport(viewport, maxDimension) {
    if (!maxDimension || maxDimension <= 0) return viewport;

    const maxSide = Math.max(viewport.width, viewport.height);
    if (maxSide <= maxDimension) return viewport;

    const factor = maxDimension / maxSide;
    return {
        width: Math.floor(viewport.width * factor),
        height: Math.floor(viewport.height * factor),
        transformScale: factor,
    };
}

export async function renderPdfPagesToImages(file, options = {}) {
    if (!isPdfFile(file)) {
        throw new Error("renderPdfPagesToImages expects a PDF file");
    }

    const cfg = { ...DEFAULT_RENDER_OPTIONS, ...options };
    const pdfjs = await getPdfJs();
    const buffer = await file.arrayBuffer();

    const loadingTask = pdfjs.getDocument({
        data: buffer,
        disableWorker: false,
    });

    const doc = await loadingTask.promise;
    const pageCount = doc.numPages;
    const pagesToRender = clamp(cfg.maxPages, 1, pageCount);

    const images = [];

    for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber += 1) {
        const page = await doc.getPage(pageNumber);

        const rawViewport = page.getViewport({ scale: cfg.scale });
        const fitted = fitViewport(rawViewport, cfg.maxDimension);

        const renderScale = fitted.transformScale ?? 1;
        const viewport =
            renderScale === 1
                ? rawViewport
                : page.getViewport({ scale: cfg.scale * renderScale });

        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext("2d", { alpha: false });

        await page.render({
            canvasContext: ctx,
            viewport,
        }).promise;

        const dataUrl = canvas.toDataURL(cfg.imageType, cfg.imageQuality);
        images.push({
            pageNumber,
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            mimeType: cfg.imageType,
        });

        // release memory
        canvas.width = 1;
        canvas.height = 1;
    }

    return {
        strategy: "vision",
        pageCount,
        renderedPages: pagesToRender,
        images,
    };
}

/**
 * High-level helper:
 * - tries text extraction first
 * - if low-quality text, returns rendered page images for vision model fallback
 */
export async function extractPdfTextOrRenderForVision(file, options = {}) {
    const textOptions = { ...DEFAULT_TEXT_OPTIONS, ...(options.text || {}) };
    const renderOptions = {
        ...DEFAULT_RENDER_OPTIONS,
        ...(options.render || {}),
    };

    const textResult = await extractPdfText(file, textOptions);

    if (textResult.quality.usable) {
        return {
            strategy: "text",
            textResult,
            imageResult: null,
        };
    }

    const imageResult = await renderPdfPagesToImages(file, renderOptions);

    return {
        strategy: "vision",
        textResult,
        imageResult,
    };
}
