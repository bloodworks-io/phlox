import { localModelApi } from "../api/localModelApi";
import { toaster } from "@/components/ui/toaster";

/**
 * Downloads an LLM model and restarts the llama server
 * @param {string} modelId - The model ID to download
 * @param {Object} options - Configuration options
 * @param {Function} options.onProgress - Callback for progress updates: (progress) => void
 * @param {Function} options.onStart - Callback when download starts: () => void
 * @param {Object} options.toast - Chakra UI toast function from useToast()
 * @returns {Promise<void>} - Resolves when complete, rejects on error
 */
export async function downloadLlmModel(modelId, { onProgress, onStart, toast }) {
  try {
    for await (const event of localModelApi.streamDownloadLlmModel(modelId)) {
      if (event.type === "start") {
        onStart?.();
      } else if (event.type === "progress") {
        onProgress?.(event);
      } else if (event.type === "complete") {
        // Restart llama server to use the new model
        try {
          await localModelApi.restartLlamaServer();
          toaster.create({
            title: "Success",
            description: "Model downloaded and server restarted",
            type: "success",
            duration: 3000,
          });
        } catch (restartError) {
          // Model downloaded but restart failed - still notify user of success
          console.error("Error restarting llama server:", restartError);
          toaster.create({
            title: "Model Downloaded",
            description: "Model downloaded. Please restart the app to use it.",
            type: "info",
            duration: 5000,
          });
        }
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  } catch (error) {
    console.error("Error downloading model:", error);
    toaster.create({
      title: "Error",
      description: `Failed to download model: ${error.message}`,
      type: "error",
      duration: 5000,
    });
    throw error;
  }
}

/**
 * Downloads a Whisper model and restarts the whisper server
 * @param {string} modelId - The model ID to download
 * @param {Object} options - Configuration options
 * @param {Function} options.onProgress - Callback for progress updates: (progress) => void
 * @param {Function} options.onStart - Callback when download starts: () => void
 * @param {Object} options.toast - Chakra UI toast function from useToast()
 * @returns {Promise<void>} - Resolves when complete, rejects on error
 */
export async function downloadWhisperModel(modelId, { onProgress, onStart, toast }) {
  try {
    for await (const event of localModelApi.streamDownloadWhisperModel(modelId)) {
      if (event.type === "start") {
        onStart?.();
      } else if (event.type === "progress") {
        onProgress?.(event);
      } else if (event.type === "complete") {
        // Restart whisper server to use the new model
        try {
          await localModelApi.restartWhisperServer();
          toaster.create({
            title: "Success",
            description: `Whisper model ${modelId} downloaded and server restarted`,
            type: "success",
            duration: 3000,
          });
        } catch (restartError) {
          // Model downloaded but restart failed - still notify user of success
          console.error("Error restarting Whisper server:", restartError);
          toaster.create({
            title: "Model Downloaded",
            description: `Whisper model ${modelId} downloaded. Please restart the app to use it.`,
            type: "info",
            duration: 5000,
          });
        }
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  } catch (error) {
    console.error("Error downloading Whisper model:", error);
    toaster.create({
      title: "Error",
      description: `Failed to download Whisper model: ${error.message}`,
      type: "error",
      duration: 5000,
    });
    throw error;
  }
}

/**
 * Downloads an embedding model and restarts the embedding server
 */
export async function downloadEmbeddingModel(modelId, { onProgress, onStart, toast }) {
  try {
    for await (const event of localModelApi.streamDownloadEmbeddingModel(modelId)) {
      if (event.type === "start") {
        onStart?.();
      } else if (event.type === "progress") {
        onProgress?.(event);
      } else if (event.type === "complete") {
        try {
          await localModelApi.restartEmbeddingServer();
          toaster.create({
            title: "Success",
            description: "Embedding model downloaded",
            type: "success",
            duration: 3000,
          });
        } catch (restartError) {
          console.error("Error restarting embedding server:", restartError);
          toaster.create({
            title: "Model Downloaded",
            description: "Embedding model downloaded. Please restart the app.",
            type: "info",
            duration: 5000,
          });
        }
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  } catch (error) {
    console.error("Error downloading embedding model:", error);
    toaster.create({
      title: "Error",
      description: `Failed to download embedding model: ${error.message}`,
      type: "error",
      duration: 5000,
    });
    throw error;
  }
}
