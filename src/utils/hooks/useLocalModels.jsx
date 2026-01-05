import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { localModelApi } from "../api/localModelApi";
import { invoke } from "@tauri-apps/api/core";

export const useLocalModels = () => {
  const [models, setModels] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [repoFiles, setRepoFiles] = useState({});
  const [localStatus, setLocalStatus] = useState(null);
  const [systemSpecs, setSystemSpecs] = useState(null);
  const [downloadingModel, setDownloadingModel] = useState(null);

  // Whisper models state
  const [whisperModels, setWhisperModels] = useState([]);
  const [whisperRecommendations, setWhisperRecommendations] = useState([]);
  const [whisperStatus, setWhisperStatus] = useState(null);
  const [downloadingWhisperModel, setDownloadingWhisperModel] = useState(null);

  const toast = useToast();

  // Fetch system specifications
  const fetchSystemSpecs = useCallback(async () => {
    try {
      const specs = await invoke("get_system_specs");
      setSystemSpecs(specs);
      return specs;
    } catch (error) {
      console.error("Error getting system specs:", error);
      toast({
        title: "Warning",
        description: "Could not retrieve system specifications",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return null;
    }
  }, [toast]);

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

  // Fetch model recommendations (same as available models now)
  const fetchModelRecommendations = useCallback(async () => {
    return await fetchAvailableModels();
  }, [fetchAvailableModels]);

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

  // Search models on HuggingFace
  const searchModels = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return [];
    }

    setLoading(true);
    try {
      const response = await localModelApi.searchModels(query);
      setSearchResults(response.models || []);
      return response.models || [];
    } catch (error) {
      console.error("Error searching models:", error);
      setSearchResults([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get repository files
  const fetchRepoFiles = useCallback(async (repoId) => {
    if (!repoId) {
      setRepoFiles({});
      return {};
    }

    setLoading(true);
    try {
      const response = await localModelApi.getRepoFiles(repoId);
      setRepoFiles(response.quantizations || {});
      return response;
    } catch (error) {
      console.error("Error fetching repo files:", error);
      setRepoFiles({});
      return {};
    } finally {
      setLoading(false);
    }
  }, []);

  // Download LLM model (supports both pre-configured and custom)
  const downloadLlmModel = useCallback(
    async (modelId) => {
      setDownloadingModel(modelId);
      try {
        await localModelApi.downloadLlmModel(modelId);
        await fetchLocalModels();

        // Restart the llama server to use the new model
        try {
          await localModelApi.restartLlamaServer();
          toast({
            title: "Success",
            description: `Model downloaded and server restarted`,
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        } catch (restartError) {
          // Model downloaded but restart failed - still notify user of success
          console.error("Error restarting llama server:", restartError);
          toast({
            title: "Model Downloaded",
            description: `Model downloaded. Please restart the app to use it.`,
            status: "info",
            duration: 5000,
            isClosable: true,
          });
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
      } finally {
        setDownloadingModel(null);
      }
    },
    [fetchLocalModels, toast],
  );

  // Delete LLM model
  const deleteLlmModel = useCallback(
    async (filename) => {
      try {
        await localModelApi.deleteLlmModel(filename);
        await fetchLocalModels();
        toast({
          title: "Success",
          description: `Model deleted successfully`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        console.error("Error deleting model:", error);
        toast({
          title: "Error",
          description: `Failed to delete model: ${error.message}`,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    },
    [fetchLocalModels, toast],
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
      setDownloadingWhisperModel(modelId);
      try {
        await localModelApi.downloadWhisperModel(modelId);
        await fetchWhisperModels();

        // Restart the whisper server to use the new model
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
      } catch (error) {
        console.error("Error downloading Whisper model:", error);
        toast({
          title: "Error",
          description: `Failed to download Whisper model: ${error.message}`,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setDownloadingWhisperModel(null);
      }
    },
    [fetchWhisperModels, toast],
  );

  // Delete Whisper model
  const deleteWhisperModel = useCallback(
    async (modelId) => {
      try {
        await localModelApi.deleteWhisperModel(modelId);
        await fetchWhisperModels();
        toast({
          title: "Success",
          description: `Whisper model ${modelId} deleted successfully`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        console.error("Error deleting Whisper model:", error);
        toast({
          title: "Error",
          description: `Failed to delete Whisper model: ${error.message}`,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    },
    [fetchWhisperModels, toast],
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
    searchResults,
    loading,
    searchQuery,
    setSearchQuery,
    selectedRepo,
    setSelectedRepo,
    repoFiles,
    localStatus,
    systemSpecs,
    modelRecommendations: availableModels,
    downloadingModel,

    // Whisper state
    whisperModels,
    whisperRecommendations,
    whisperStatus,
    downloadingWhisperModel,

    // Actions
    searchModels,
    fetchRepoFiles,
    downloadLlmModel,
    deleteLlmModel,
    refreshData,

    // Whisper actions
    downloadWhisperModel,
    deleteWhisperModel,
    restartWhisperServer: () => localModelApi.restartWhisperServer(),
  };
};
