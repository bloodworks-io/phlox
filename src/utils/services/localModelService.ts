import { localModelApi } from "../api/localModelApi";

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
          toast({
            title: "Success",
            description: "Model downloaded and server restarted",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        } catch (restartError) {
          // Model downloaded but restart failed - still notify user of success
          console.error("Error restarting llama server:", restartError);
          toast({
            title: "Model Downloaded",
            description: "Model downloaded. Please restart the app to use it.",
            status: "info",
            duration: 5000,
            isClosable: true,
          });
        }
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  } catch (error) {
    console.error("Error downloading model:", error);
    toast({
      title: "Error",
      description: `Failed to download model: ${error.message}`,
      status: "error",
      duration: 5000,
      isClosable: true,
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
          toast({
            title: "Success",
            description: `Whisper model ${modelId} downloaded and server restarted`,
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        } catch (restartError) {
          // Model downloaded but restart failed - still notify user of success
          console.error("Error restarting Whisper server:", restartError);
          toast({
            title: "Model Downloaded",
            description: `Whisper model ${modelId} downloaded. Please restart the app to use it.`,
            status: "info",
            duration: 5000,
            isClosable: true,
          });
        }
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  } catch (error) {
    console.error("Error downloading Whisper model:", error);
    toast({
      title: "Error",
      description: `Failed to download Whisper model: ${error.message}`,
      status: "error",
      duration: 5000,
      isClosable: true,
    });
    throw error;
  }
}
