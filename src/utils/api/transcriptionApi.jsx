import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const transcriptionApi = {
    transcribeAudio: async (formData) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(`/api/transcribe/audio`);
                return universalFetch(url, {
                    method: "POST",
                    body: formData,
                    signal: signal,
                });
            },
            errorMessage: "Error transcribing audio",
        });
    },

    reprocessTranscription: async (formData) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(`/api/transcribe/reprocess`);
                return universalFetch(url, {
                    method: "POST",
                    body: formData,
                    signal: signal,
                });
            },
            timeout: 120000,
            errorMessage: "Error reprocessing transcription",
        });
    },

    transcribeDictation: async (formData) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(`/api/transcribe/dictate`);
                return universalFetch(url, {
                    method: "POST",
                    body: formData,
                });
            },
            errorMessage: "Error transcribing dictation",
        });
    },

    processDocument: async (formData) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    `/api/transcribe/process-document`,
                );
                return universalFetch(url, {
                    method: "POST",
                    body: formData,
                });
            },
            errorMessage: "Error processing document",
        });
    },

    processDocumentFromText: async (payload) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    `/api/transcribe/process-document-from-text`,
                );
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            },
            errorMessage: "Error processing extracted document text",
        });
    },

    processDocumentVisual: async (payload) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    `/api/transcribe/process-document-visual`,
                );
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            },
            errorMessage: "Error processing visual document",
        });
    },
};
