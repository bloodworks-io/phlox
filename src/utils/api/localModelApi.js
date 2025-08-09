import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const localModelApi = {
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
        const url = await buildApiUrl("/api/config/local/model-recommendations");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch model recommendations",
    }),

  fetchOllamaModels: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/list");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch Ollama models",
    }),

  checkLocalStatus: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/status");
        return universalFetch(url);
      },
      errorMessage: "Failed to check local status",
    }),

  pullOllamaModel: async (modelName) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/pull-ollama-model");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_name: modelName }),
        });
      },
      successMessage: "Model downloaded successfully",
      errorMessage: "Failed to download model",
    }),

  searchModels: async (query) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/local/search?query=${encodeURIComponent(query)}`);
        return universalFetch(url);
      },
      errorMessage: "Failed to search models",
    }),

  getRepoFiles: async (repoId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/local/repo-files/${repoId}`);
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch repository files",
    }),

  downloadModel: async (repoId, filename) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/download");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo_id: repoId,
            filename: filename
          }),
        });
      },
      successMessage: "Model download started",
      errorMessage: "Failed to start model download",
      timeout: 300000, // 5 minutes for model downloads
    }),

  deleteModel: async (modelName) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/delete");
        return universalFetch(url, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_name: modelName }),
        });
      },
      successMessage: "Model deleted successfully",
      errorMessage: "Failed to delete model",
    }),

  getModelInfo: async (modelName) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/local/model-info/${encodeURIComponent(modelName)}`);
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch model information",
    }),

  validateModelCompatibility: async (modelName, systemSpecs) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/validate-compatibility");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model_name: modelName,
            system_specs: systemSpecs
          }),
        });
      },
      errorMessage: "Failed to validate model compatibility",
    }),

  getDownloadProgress: async (downloadId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/local/download-progress/${downloadId}`);
        return universalFetch(url);
      },
      errorMessage: "Failed to get download progress",
    }),

  cancelDownload: async (downloadId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/local/cancel-download/${downloadId}`);
        return universalFetch(url, {
          method: "POST",
        });
      },
      successMessage: "Download cancelled",
      errorMessage: "Failed to cancel download",
    }),

  updateModelConfig: async (modelName, config) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/local/model-config");
        return universalFetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model_name: modelName,
            config: config
          }),
        });
      },
      successMessage: "Model configuration updated",
      errorMessage: "Failed to update model configuration",
    }),
};
