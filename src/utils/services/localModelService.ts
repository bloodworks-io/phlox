import { localModelApi } from "../api/localModelApi";
import { t } from "@/i18n";
import { toaster } from "@/components/ui/toaster";

/**
 * Downloads an LLM model and restarts the llama server
 * @param {string} modelId - The model ID to download
 * @param {Object} options - Configuration options
 * @param {Function} options.onProgress - Callback for progress updates: (progress) => void
 * @param {Function} options.onStart - Callback when download starts: () => void
 * @returns {Promise<void>} - Resolves when complete, rejects on error
 */
export async function downloadLlmModel(modelId, { onProgress, onStart }) {
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
            title: t("toast.success"),
            description: t("localModels.toast.downloadedAndRestarted"),
            type: "success",
            duration: 3000,
          });
        } catch (restartError) {
          // Model downloaded but restart failed - still notify user of success
          console.error("Error restarting llama server:", restartError);
          toaster.create({
            title: t("localModels.toast.modelDownloaded"),
            description: t("localModels.toast.restartNeeded"),
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
      title: t("toast.error"),
      description: t("localModels.toast.downloadFailed", {
        message: error.message,
      }),
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
 * @returns {Promise<void>} - Resolves when complete, rejects on error
 */
export async function downloadWhisperModel(modelId, { onProgress, onStart }) {
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
            title: t("toast.success"),
            description: t("localModels.toast.whisperDownloadedAndRestarted", {
              model: modelId,
            }),
            type: "success",
            duration: 3000,
          });
        } catch (restartError) {
          // Model downloaded but restart failed - still notify user of success
          console.error("Error restarting Whisper server:", restartError);
          toaster.create({
            title: t("localModels.toast.modelDownloaded"),
            description: t("localModels.toast.whisperRestartNeeded", {
              model: modelId,
            }),
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
      title: t("toast.error"),
      description: t("localModels.toast.whisperDownloadFailed", {
        message: error.message,
      }),
      type: "error",
      duration: 5000,
    });
    throw error;
  }
}

/**
 * Downloads the embedding model and restarts the embedding server
 */
export async function downloadEmbeddingModel({ onProgress, onStart }) {
  try {
    for await (const event of localModelApi.streamDownloadEmbeddingModel()) {
      if (event.type === "start") {
        onStart?.();
      } else if (event.type === "progress") {
        onProgress?.(event);
      } else if (event.type === "complete") {
        try {
          await localModelApi.restartEmbeddingServer();
          toaster.create({
            title: t("toast.success"),
            description: t("localModels.toast.embeddingDownloaded"),
            type: "success",
            duration: 3000,
          });
        } catch (restartError) {
          console.error("Error restarting embedding server:", restartError);
          toaster.create({
            title: t("localModels.toast.modelDownloaded"),
            description: t("localModels.toast.embeddingRestartNeeded"),
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
      title: t("toast.error"),
      description: t("localModels.toast.embeddingDownloadFailed", {
        message: error.message,
      }),
      type: "error",
      duration: 5000,
    });
    throw error;
  }
}
