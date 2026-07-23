import { useState, useEffect, useCallback } from "react";
import { toaster } from "@/components/ui/toaster";
import { localModelApi } from "../api/localModelApi";
import { invoke } from "@tauri-apps/api/core";
import { downloadLlmModel as downloadLlmService, downloadWhisperModel as downloadWhisperService } from "../services/localModelService";

export const useLocalModels = () => {
  const [models, setModels] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(null);
  const [systemSpecs, setSystemSpecs] = useState(null);

  // Download progress state for LLM models
  const [downloadProgress, setDownloadProgress] = useState({
    llm: null, // { percentage, downloadedBytes, totalBytes, speedBytesPerSec, etaSeconds }
    whisper: null,
  });
  const [isDownloading, setIsDownloading] = useState({
    llm: false,
    whisper: false,
  });
  const [downloadingModelId, setDownloadingModelId] = useState({
    llm: null,
    whisper: null,
  });

  // Whisper models state
  const [whisperModels, setWhisperModels] = useState([]);
  const [whisperRecommendations, setWhisperRecommendations] = useState([]);
  const [whisperStatus, setWhisperStatus] = useState(null);


  // Fetch system specifications
  const fetchSystemSpecs = useCallback(async () => {
    try {
      const specs = await invoke("get_system_specs");
      setSystemSpecs(specs);
      return specs;
    } catch (error) {
      console.error("Error getting system specs:", error);
      toaster.create({
        title: "Warning",
        description: "Could not retrieve system specifications",
        type: "warning",
        duration: 3000,
      });
      return null;
    }
  }, []);

  // Fetch downloaded local models
  const fetchLocalModels = useCallback(async () => {
    try {
      const response = await localModelApi.fetchLocalModels();
      setModels(response.models || []);
      return response.models || [];
    } catch (error) {
      console.error("Error fetching local models:", error);
      setModels([]);
      return [];
    }
  }, []);

  // Fetch available pre-configured models
  const fetchAvailableModels = useCallback(async () => {
    try {
      const response = await localModelApi.fetchAvailableLlmModels();
      setAvailableModels(response.models || []);
      return response.models || [];
    } catch (error) {
      console.error("Error fetching available models:", error);
      setAvailableModels([]);
      return [];
    }
  }, []);

  // Check local status
  const checkLocalStatus = useCallback(async () => {
    try {
      const response = await localModelApi.checkLocalStatus();
      setLocalStatus(response);
      return response;
    } catch (error) {
      console.error("Error checking local status:", error);
      setLocalStatus(null);
      return null;
    }
  }, []);

  // Download LLM model (supports both pre-configured and custom)
  const downloadLlmModel = useCallback(
    async (modelId) => {
      setIsDownloading((prev) => ({ ...prev, llm: true }));
      setDownloadingModelId((prev) => ({ ...prev, llm: modelId }));
      setDownloadProgress((prev) => ({ ...prev, llm: { percentage: 0 } }));

      try {
        await downloadLlmService(modelId, {
          onStart: () => {
            setDownloadProgress((prev) => ({
              ...prev,
              llm: { percentage: 0, status: "starting" },
            }));
          },
          onProgress: (event) => {
            setDownloadProgress((prev) => ({
              ...prev,
              llm: {
                percentage: event.percentage,
                downloadedBytes: event.downloaded_bytes,
                totalBytes: event.total_bytes,
                speedBytesPerSec: event.speed_bytes_per_sec,
                etaSeconds: event.eta_seconds,
                currentFile: event.current_file,
              },
            }));
          },
        });

        // Refresh models after successful download
        await fetchLocalModels();
      } finally {
        setIsDownloading((prev) => ({ ...prev, llm: false }));
        setDownloadingModelId((prev) => ({ ...prev, llm: null }));
        setDownloadProgress((prev) => ({ ...prev, llm: null }));
      }
    },
    [fetchLocalModels],
  );

  // Delete LLM model
  const deleteLlmModel = useCallback(
    async (filename) => {
      try {
        await localModelApi.deleteLlmModel(filename);
        await fetchLocalModels();
        toaster.create({
          title: "Success",
          description: `Model deleted successfully`,
          type: "success",
          duration: 3000,
        });
      } catch (error) {
        console.error("Error deleting model:", error);
        toaster.create({
          title: "Error",
          description: `Failed to delete model: ${error.message}`,
          type: "error",
          duration: 5000,
        });
      }
    },
    [fetchLocalModels],
  );

  // ========== Whisper Model Functions ==========

  // Fetch Whisper models
  const fetchWhisperModels = useCallback(async () => {
    try {
      const response = await localModelApi.fetchWhisperModels();
      setWhisperModels(response.models || []);
      return response.models || [];
    } catch (error) {
      console.error("Error fetching Whisper models:", error);
      setWhisperModels([]);
      return [];
    }
  }, []);

  // Fetch Whisper model recommendations
  const fetchWhisperRecommendations = useCallback(async () => {
    try {
      const response = await localModelApi.fetchWhisperRecommendations();
      setWhisperRecommendations(response.models || []);
      return response.models || [];
    } catch (error) {
      console.error("Error fetching Whisper recommendations:", error);
      setWhisperRecommendations([]);
      return [];
    }
  }, []);

  // Fetch Whisper status
  const fetchWhisperStatus = useCallback(async () => {
    try {
      const response = await localModelApi.fetchWhisperStatus();
      setWhisperStatus(response);
      return response;
    } catch (error) {
      console.error("Error fetching Whisper status:", error);
      setWhisperStatus(null);
      return null;
    }
  }, []);

  // Download Whisper model
  const downloadWhisperModel = useCallback(
    async (modelId) => {
      setIsDownloading((prev) => ({ ...prev, whisper: true }));
      setDownloadingModelId((prev) => ({ ...prev, whisper: modelId }));
      setDownloadProgress((prev) => ({ ...prev, whisper: { percentage: 0 } }));

      try {
        await downloadWhisperService(modelId, {
          onStart: () => {
            setDownloadProgress((prev) => ({
              ...prev,
              whisper: { percentage: 0, status: "starting" },
            }));
          },
          onProgress: (event) => {
            setDownloadProgress((prev) => ({
              ...prev,
              whisper: {
                percentage: event.percentage,
                downloadedBytes: event.downloaded_bytes,
                totalBytes: event.total_bytes,
                speedBytesPerSec: event.speed_bytes_per_sec,
                etaSeconds: event.eta_seconds,
                currentFile: event.current_file,
              },
            }));
          },
        });

        // Refresh models after successful download
        await fetchWhisperModels();
      } finally {
        setIsDownloading((prev) => ({ ...prev, whisper: false }));
        setDownloadingModelId((prev) => ({ ...prev, whisper: null }));
        setDownloadProgress((prev) => ({ ...prev, whisper: null }));
      }
    },
    [fetchWhisperModels],
  );

  // Delete Whisper model
  const deleteWhisperModel = useCallback(
    async (modelId) => {
      try {
        await localModelApi.deleteWhisperModel(modelId);
        await fetchWhisperModels();
        toaster.create({
          title: "Success",
          description: `Whisper model ${modelId} deleted successfully`,
          type: "success",
          duration: 3000,
        });
      } catch (error) {
        console.error("Error deleting Whisper model:", error);
        toaster.create({
          title: "Error",
          description: `Failed to delete Whisper model: ${error.message}`,
          type: "error",
          duration: 5000,
        });
      }
    },
    [fetchWhisperModels],
  );

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        fetchSystemSpecs(),
        fetchLocalModels(),
        fetchAvailableModels(),
        checkLocalStatus(),
        fetchWhisperModels(),
        fetchWhisperRecommendations(),
        fetchWhisperStatus(),
      ]);
    };

    initializeData();
  }, [
    fetchSystemSpecs,
    fetchLocalModels,
    fetchAvailableModels,
    checkLocalStatus,
    fetchWhisperModels,
    fetchWhisperRecommendations,
    fetchWhisperStatus,
  ]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchLocalModels(),
        fetchAvailableModels(),
        checkLocalStatus(),
        fetchWhisperModels(),
        fetchWhisperStatus(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [
    fetchLocalModels,
    fetchAvailableModels,
    checkLocalStatus,
    fetchWhisperModels,
    fetchWhisperStatus,
  ]);

  return {
    // State
    models,
    availableModels,
    loading,
    localStatus,
    systemSpecs,
    modelRecommendations: availableModels,
    downloadProgress,
    isDownloading,
    downloadingModelId,

    // Whisper state
    whisperModels,
    whisperRecommendations,
    whisperStatus,

    // Actions
    downloadLlmModel,
    deleteLlmModel,
    refreshData,

    // Whisper actions
    downloadWhisperModel,
    deleteWhisperModel,
    restartWhisperServer: () => localModelApi.restartWhisperServer(),
  };
};
