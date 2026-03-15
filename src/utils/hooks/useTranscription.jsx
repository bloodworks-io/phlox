import { useState } from "react";
import { transcriptionApi } from "../api/transcriptionApi";
import { handleProcessingComplete } from "../helpers/processingHelpers";
import { buildApiUrl, isTauri } from "../helpers/apiConfig";
import { universalFetch } from "../helpers/apiHelpers";
import {
    convertFileToDataUrl,
    extractPdfTextOrRenderForVision,
    isPdfFile,
    renderPdfPagesToImages,
} from "../helpers/pdfVisionHelpers";

/**
 * Convert audio to WAV format using the Tauri command (macOS only).
 * This is needed because whisper.cpp only accepts WAV files.
 * Exported for use in components that don't use the useTranscription hook.
 */
export const convertAudioToWav = async (audioBlob) => {
    if (!isTauri()) {
        // Not running in Tauri, skip conversion
        return audioBlob;
    }

    try {
        const { invoke } = await import("@tauri-apps/api/core");
        const audioBytes = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(audioBytes);
        const wavBytes = await invoke("convert_audio_to_wav", {
            audioBytes: Array.from(uint8Array),
        });
        return new Blob([new Uint8Array(wavBytes)], { type: "audio/wav" });
    } catch (error) {
        console.error("Audio conversion failed, using original audio:", error);
        // If conversion fails, continue with original audio
        return audioBlob;
    }
};

const normalizeProcessingMode = (value) => {
    const raw = String(value || "")
        .trim()
        .toLowerCase();
    if (raw === "vision" || raw === "ocr" || raw === "auto") return raw;
    return "auto";
};

const getDocumentProcessingPreferences = async () => {
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

export const useTranscription = (onTranscriptionComplete, setLoading) => {
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptionError, setTranscriptionError] = useState(null);

    const transcribeAudio = async (audioBlob, metadata, isAmbient = true) => {
        setIsTranscribing(true);
        setTranscriptionError(null);
        if (setLoading) setLoading(true);

        try {
            // Convert audio to WAV format if in Tauri (macOS)
            const wavBlob = await convertAudioToWav(audioBlob);

            const formData = new FormData();
            formData.append("file", wavBlob, "recording.wav");

            // Add metadata if provided
            if (metadata.name) formData.append("name", metadata.name);
            if (metadata.gender) formData.append("gender", metadata.gender);
            if (metadata.dob) formData.append("dob", metadata.dob);
            if (metadata.templateKey)
                formData.append("templateKey", metadata.templateKey);
            formData.append("isAmbient", isAmbient);

            const data = await transcriptionApi.transcribeAudio(formData);

            if (onTranscriptionComplete) {
                onTranscriptionComplete(data, true);
            }

            return data;
        } catch (error) {
            setTranscriptionError(error.message);
            if (onTranscriptionComplete) {
                onTranscriptionComplete({ error: error.message });
            }
            throw error;
        } finally {
            setIsTranscribing(false);
            if (setLoading) setLoading(false);
        }
    };

    const reprocessTranscription = async (
        transcriptText,
        metadata,
        originalTranscriptionDuration,
        isAmbient = true,
    ) => {
        setIsTranscribing(true);
        setTranscriptionError(null);
        if (setLoading) setLoading(true);

        try {
            const formData = new FormData();
            formData.append("transcript_text", transcriptText);

            // Add metadata if provided
            if (metadata.name) formData.append("name", metadata.name);
            if (metadata.gender) formData.append("gender", metadata.gender);
            if (metadata.dob) formData.append("dob", metadata.dob);
            if (metadata.templateKey)
                formData.append("templateKey", metadata.templateKey);
            formData.append("isAmbient", isAmbient);

            formData.append(
                "original_transcription_duration",
                originalTranscriptionDuration || 0,
            );

            const data =
                await transcriptionApi.reprocessTranscription(formData);

            if (onTranscriptionComplete) {
                onTranscriptionComplete(data, true);
            }

            return data;
        } catch (error) {
            setTranscriptionError(error.message);
            if (onTranscriptionComplete) {
                onTranscriptionComplete({ error: error.message });
            }
            throw error;
        } finally {
            setIsTranscribing(false);
            if (setLoading) setLoading(false);
        }
    };

    const processDocument = async (file, metadata, options = {}) => {
        setIsTranscribing(true);
        setTranscriptionError(null);
        if (setLoading) setLoading(true);

        try {
            const mime = (file?.type || "").toLowerCase();
            const filename = (file?.name || "").toLowerCase();
            const isPdf = isPdfFile(file);
            const isTextFile =
                mime === "text/plain" || filename.endsWith(".txt");
            const isImageFile = mime.startsWith("image/");

            let data;

            if (isTextFile) {
                const extractedText = await file.text();
                data = await transcriptionApi.processDocumentFromText({
                    extracted_text: extractedText,
                    ...buildMetadataPayload(metadata),
                });
            } else if (isPdf || isImageFile) {
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

                const processViaLegacyOcr = async () => {
                    const formData = new FormData();
                    formData.append("file", file);

                    if (metadata?.name) formData.append("name", metadata.name);
                    if (metadata?.gender)
                        formData.append("gender", metadata.gender);
                    if (metadata?.dob) formData.append("dob", metadata.dob);
                    if (metadata?.templateKey)
                        formData.append("templateKey", metadata.templateKey);

                    return transcriptionApi.processDocument(formData);
                };

                if (isPdf) {
                    try {
                        const pdfResult = await extractPdfTextOrRenderForVision(
                            file,
                            {
                                text: { maxPages: 25 },
                                render: { maxPages: 8, scale: 1.6 },
                            },
                        );

                        const extractedText = (
                            pdfResult.textResult?.text || ""
                        ).trim();

                        if (pdfResult.strategy === "text" && extractedText) {
                            data =
                                await transcriptionApi.processDocumentFromText({
                                    extracted_text: extractedText,
                                    ...buildMetadataPayload(metadata),
                                });
                        } else {
                            if (!shouldUseVision) {
                                throw new Error(
                                    "PDF requires visual fallback but vision mode/capability is unavailable.",
                                );
                            }

                            const pages = (
                                pdfResult.imageResult?.images || []
                            ).map((img) => ({
                                page_number: img.pageNumber,
                                data_url: img.dataUrl,
                                mime_type: img.mimeType,
                                width: img.width,
                                height: img.height,
                            }));

                            if (!pages.length) {
                                throw new Error(
                                    "No visual pages could be prepared from this PDF",
                                );
                            }

                            data = await transcriptionApi.processDocumentVisual(
                                {
                                    pages,
                                    filename: file?.name || "uploaded-document",
                                    content_type:
                                        mime || "application/octet-stream",
                                    ...buildMetadataPayload(metadata),
                                },
                            );
                        }
                    } catch (pdfError) {
                        if (!allowOcrFallback) {
                            throw pdfError;
                        }
                        data = await processViaLegacyOcr();
                    }
                } else {
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

                            data = await transcriptionApi.processDocumentVisual(
                                {
                                    pages,
                                    filename: file?.name || "uploaded-document",
                                    content_type:
                                        mime || "application/octet-stream",
                                    ...buildMetadataPayload(metadata),
                                },
                            );
                        } catch (visionError) {
                            if (!allowOcrFallback) {
                                throw visionError;
                            }
                            data = await processViaLegacyOcr();
                        }
                    } else {
                        data = await processViaLegacyOcr();
                    }
                }
            } else {
                // Other file formats (doc/docx, etc.) remain legacy backend flow
                const formData = new FormData();
                formData.append("file", file);

                if (metadata?.name) formData.append("name", metadata.name);
                if (metadata?.gender)
                    formData.append("gender", metadata.gender);
                if (metadata?.dob) formData.append("dob", metadata.dob);
                if (metadata?.templateKey)
                    formData.append("templateKey", metadata.templateKey);

                data = await transcriptionApi.processDocument(formData);
            }

            if (options.handleComplete) {
                options.handleComplete(data);
            }

            return data;
        } catch (error) {
            setTranscriptionError(error.message);
            if (options.handleError) {
                options.handleError(error);
            }
            throw error;
        } finally {
            setIsTranscribing(false);
            if (setLoading) setLoading(false);
        }
    };

    return {
        transcribeAudio,
        processDocument,
        reprocessTranscription,
        isTranscribing,
        transcriptionError,
    };
};
