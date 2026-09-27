import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

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
            errorMessage: t("api.transcription.transcribeAudioFailed"),
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
            errorMessage: t("api.transcription.reprocessFailed"),
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
            errorMessage: t("api.transcription.transcribeDictationFailed"),
        });
    },

    processDocument: async (formData) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/transcribe/process-document`,
                );
                return universalFetch(url, {
                    method: "POST",
                    body: formData,
                    signal,
                });
            },
            timeout: 180000,
            errorMessage: t("api.transcription.processDocumentFailed"),
        });
    },

    extractDemographics: async (formData) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/transcribe/extract-demographics`,
                );
                return universalFetch(url, {
                    method: "POST",
                    body: formData,
                    signal,
                });
            },
            timeout: 180000,
            errorMessage: t("api.transcription.extractDemographicsFailed"),
        });
    },

    extractDemographicsFromText: async (payload) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/transcribe/extract-demographics-from-text`,
                );
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal,
                });
            },
            timeout: 180000,
            errorMessage: t("api.transcription.extractDemographicsFromTextFailed"),
        });
    },

    extractDemographicsVisual: async (payload) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/transcribe/extract-demographics-visual`,
                );
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal,
                });
            },
            timeout: 300000,
            errorMessage: t("api.transcription.extractDemographicsVisualFailed"),
        });
    },

    processDocumentFromText: async (payload) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/transcribe/process-document-from-text`,
                );
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal,
                });
            },
            timeout: 180000,
            errorMessage: t("api.transcription.processDocumentFromTextFailed"),
        });
    },

    processDocumentVisual: async (payload) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/transcribe/process-document-visual`,
                );
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal,
                });
            },
            timeout: 300000,
            errorMessage: t("api.transcription.processDocumentVisualFailed"),
        });
    },
};
