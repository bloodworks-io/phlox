// API client for the live scribe agent backend.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

export const liveAgentApi = {
    startSession: async (payload) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/agent-live/sessions");
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal,
                });
            },
            errorMessage: t("api.liveAgent.startFailed"),
        });
    },

    sendAudioChunk: async (sessionId, blob) => {
        const url = await buildApiUrl(
            `/api/agent-live/sessions/${sessionId}/audio`,
        );
        const formData = new FormData();
        formData.append("file", blob, "segment.wav");
        const response = await universalFetch(url, {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            throw new Error(t("api.liveAgent.audioUploadFailed", { status: response.status }) as string);
        }
        return true;
    },

    sendFeedback: async (sessionId, fields) => {
        const url = await buildApiUrl(
            `/api/agent-live/sessions/${sessionId}/feedback`,
        );
        const response = await universalFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields }),
        });
        if (!response.ok) {
            throw new Error(t("api.liveAgent.feedbackFailed", { status: response.status }) as string);
        }
        return true;
    },

    requestTidy: async (sessionId) => {
        const url = await buildApiUrl(
            `/api/agent-live/sessions/${sessionId}/tidy`,
        );
        const response = await universalFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        if (!response.ok) {
            throw new Error(t("api.liveAgent.tidyFailed", { status: response.status }) as string);
        }
        return true;
    },

    pushJobs: async (sessionId, jobs) => {
        const url = await buildApiUrl(
            `/api/agent-live/sessions/${sessionId}/jobs`,
        );
        const response = await universalFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobs }),
        });
        if (!response.ok) {
            throw new Error(t("api.liveAgent.pushJobsFailed", { status: response.status }) as string);
        }
        return true;
    },

    stopSession: async (sessionId) => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/agent-live/sessions/${sessionId}/stop`,
                );
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                    signal,
                });
            },
            errorMessage: t("api.liveAgent.stopFailed"),
        });
    },

    /**
     * Consume the SSE event stream for a live session.
     * Yields parsed event objects ({type: "transcript"|"field_update"|...}).
     */
    streamEvents: async function* (sessionId) {
        const url = await buildApiUrl(
            `/api/agent-live/sessions/${sessionId}/events`,
        );
        const response = await universalFetch(url, { method: "GET" });

        if (!response.ok) {
            throw new Error(t("api.liveAgent.streamFailed", { status: response.status }) as string);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";

            for (const part of parts) {
                for (const line of part.split("\n")) {
                    if (line.startsWith("data: ")) {
                        try {
                            yield JSON.parse(line.slice(6));
                        } catch (error) {
                            console.error("Error parsing live event:", error);
                        }
                    }
                    // ": keepalive" comments and anything else: ignored.
                }
            }
        }
    },
};
