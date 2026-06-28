// API functions for interacting with the chat service backend.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const chatApi = {
    sendMessage: async (
        messages,
        rawTranscription = null,
        patientContext = null,
    ) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/chat");
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages,
                        raw_transcription: rawTranscription,
                        patient_context: patientContext,
                    }),
                });
            },
            errorMessage: "Error in chat communication",
        });
    },

    generateLetter: async (letterData) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/generate-letter");
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(letterData),
                });
            },
            successMessage: "Letter generated successfully.",
            errorMessage: "Error generating letter",
        });
    },

    analyzeVisualDocument: async (payload) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    "/api/chat/analyze-document-visual",
                );
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            },
            errorMessage: "Error analyzing document visuals",
        });
    },

    probeVisionCapability: async (payload = {}) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/chat/vision-capability");
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            },
            errorMessage: "Error probing vision capability",
        });
    },

    getCurrentVisionCapability: async () => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    "/api/chat/vision-capability/current",
                );
                return universalFetch(url);
            },
            errorMessage: "Error fetching current vision capability",
        });
    },

    respondVisual: async (payload) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/chat/respond-visual");
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            },
            errorMessage: "Error generating visual response",
        });
    },

    uploadImage: async (file) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/chat/upload-image");
                const formData = new FormData();
                formData.append("file", file);
                return universalFetch(url, {
                    method: "POST",
                    body: formData,
                });
            },
            errorMessage: "Error uploading image",
        });
    },

    streamMessage: async function* (
        messages,
        rawTranscription = null,
        patientContext = null,
    ) {
        const url = await buildApiUrl("/api/chat");
        const response = await universalFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages,
                raw_transcription: rawTranscription,
                patient_context: patientContext,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");

            // Keep the last part in the buffer — it may be incomplete
            buffer = parts.pop() || "";

            for (const line of parts) {
                if (line.trim() && line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === "end" && data.function_response) {
                            // Handle function response at the end of stream

                            const fr = data.function_response;
                            let citations;
                            if (Array.isArray(fr)) {
                                citations = fr;
                            } else if (
                                fr &&
                                typeof fr === "object" &&
                                Array.isArray(fr.citations)
                            ) {
                                citations = fr.citations;
                            }

                            if (citations && citations.length > 0) {
                                yield {
                                    type: "context",
                                    content: Object.fromEntries(
                                        citations.map((item, index) => [
                                            index + 1,
                                            item,
                                        ]),
                                    ),
                                };
                            }
                        } else {
                            yield data;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 0));
                    } catch (error) {
                        console.error("Error parsing chunk:", error);
                    }
                }
            }
        }

        // Process any remaining data in the buffer
        if (buffer.trim() && buffer.startsWith("data: ")) {
            try {
                const data = JSON.parse(buffer.slice(6));
                yield data;
            } catch (error) {
                console.error("Error parsing final chunk:", error);
            }
        }
    },
};
