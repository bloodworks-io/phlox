// API functions for interacting with the chat service backend.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const chatApi = {
  sendMessage: async (messages, rawTranscription = null) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/chat");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            raw_transcription: rawTranscription,
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

  streamMessage: async function* (messages, rawTranscription = null) {
    const url = await buildApiUrl("/api/chat");
    const response = await universalFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        raw_transcription: rawTranscription,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n\n");

      for (const line of lines) {
        if (line.trim() && line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "end" && data.function_response) {
              // Handle function response at the end of stream
              yield {
                type: "context",
                content: data.function_response.reduce((acc, item, index) => {
                  acc[index + 1] = item;
                  return acc;
                }, {}),
              };
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
  },
};
