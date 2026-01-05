import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const localModelApi = {
  // LLM Model Management (llama-server)
  fetchAvailableLlmModels: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/models/available");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch available LLM models",
    }),

  fetchLocalModels: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/models");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch local models",
    }),

  fetchModelRecommendations: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          "/api/config/local/model-recommendations",
        );
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch model recommendations",
    }),

  checkLocalStatus: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/status");
        return universalFetch(url);
      },
      errorMessage: "Failed to check local status",
    }),

  downloadLlmModel: async (modelId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/models/download");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_id: modelId }),
        });
      },
      successMessage: "Model downloaded successfully",
      errorMessage: "Failed to download model",
      timeout: 600000, // 10 minutes for larger models
    }),

  deleteLlmModel: async (filename) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/local/models/${filename}`);
        return universalFetch(url, {
          method: "DELETE",
        });
      },
      successMessage: "Model deleted successfully",
      errorMessage: "Failed to delete model",
    }),

  restartLlamaServer: async () =>
    handleApiRequest({
      apiCall: async () => {
        // This calls the Tauri command directly
        if (window.__TAURI__) {
          const { invoke } = await import("@tauri-apps/api/core");
          return await invoke("restart_llama");
        }
        throw new Error("Llama restart is only available in Tauri builds");
      },
      successMessage: "LLM server restarted successfully",
      errorMessage: "Failed to restart LLM server",
    }),

  // HuggingFace search for custom models
  searchModels: async (query) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          `/api/config/local/search?query=${encodeURIComponent(query)}`,
        );
        return universalFetch(url);
      },
      errorMessage: "Failed to search models",
    }),

  getRepoFiles: async (repoId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          `/api/config/local/models/repo/${repoId}`,
        );
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch repository files",
    }),

  // Legacy method names (deprecated, kept for compatibility)
  downloadModel: async (repoId, filename) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/models/download");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model_id: `${repoId}/${filename}`,
          }),
        });
      },
      successMessage: "Model download started",
      errorMessage: "Failed to start model download",
      timeout: 600000, // 10 minutes for model downloads
    }),

  // Whisper model management
  fetchWhisperModels: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          "/api/config/local/whisper/models/downloaded",
        );
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch Whisper models",
    }),

  fetchAvailableWhisperModels: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          "/api/config/local/whisper/models/available",
        );
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch available Whisper models",
    }),

  fetchWhisperRecommendations: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          "/api/config/local/whisper/model-recommendations",
        );
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch Whisper model recommendations",
    }),

  downloadWhisperModel: async (modelId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          "/api/config/local/whisper/models/download",
        );
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_id: modelId }),
        });
      },
      successMessage: "Whisper model downloaded successfully",
      errorMessage: "Failed to download Whisper model",
      timeout: 300000, // 5 minutes for model downloads
    }),

  deleteWhisperModel: async (modelId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          `/api/config/local/whisper/models/${modelId}`,
        );
        return universalFetch(url, {
          method: "DELETE",
        });
      },
      successMessage: "Whisper model deleted successfully",
      errorMessage: "Failed to delete Whisper model",
    }),

  fetchWhisperStatus: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/whisper/status");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch Whisper status",
    }),

  restartWhisperServer: async () =>
    handleApiRequest({
      apiCall: async () => {
        // This calls the Tauri command directly
        if (window.__TAURI__) {
          const { invoke } = await import("@tauri-apps/api/core");
          return await invoke("restart_whisper");
        }
        throw new Error("Whisper restart is only available in Tauri builds");
      },
      successMessage: "Whisper server restarted successfully",
      errorMessage: "Failed to restart Whisper server",
    }),
};
