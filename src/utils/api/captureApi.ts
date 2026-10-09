// API client for streaming capture sessions (ambient/dictate).
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

export const captureApi = {
    startSession: async (payload) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/transcribe/capture/sessions");
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal,
                });
            },
            errorMessage: t("api.capture.startFailed"),
        });
    },

    sendAudioChunk: async (sessionId, blob) => {
        const url = await buildApiUrl(
            `/api/transcribe/capture/sessions/${sessionId}/audio`,
        );
        const formData = new FormData();
        formData.append("file", blob, "segment.wav");
        const response = await universalFetch(url, {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            throw new Error(t("api.capture.audioUploadFailed", { status: response.status }) as string);
        }
        return true;
    },

    stopSession: async (sessionId) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/transcribe/capture/sessions/${sessionId}/stop`,
                );
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                    signal,
                });
            },
            errorMessage: t("api.capture.stopFailed"),
        });
    },
};
