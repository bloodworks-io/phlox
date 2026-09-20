// API client for the live scribe agent backend.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

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
            errorMessage: "Could not start live session",
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
            throw new Error(`Audio upload failed (${response.status})`);
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
            throw new Error(`Feedback failed (${response.status})`);
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
            throw new Error(`Tidy request failed (${response.status})`);
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
            throw new Error(`Jobs push failed (${response.status})`);
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
            errorMessage: "Could not stop live session",
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
            throw new Error(`Event stream failed (${response.status})`);
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
