import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { localModelApi } from "../api/localModelApi";
import { invoke } from "@tauri-apps/api/core";

export const useLocalModels = () => {
  const [models, setModels] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [repoFiles, setRepoFiles] = useState([]);
  const [localStatus, setLocalStatus] = useState(null);
  const [systemSpecs, setSystemSpecs] = useState(null);
  const [modelRecommendations, setModelRecommendations] = useState([]);
  const [pullingModel, setPullingModel] = useState(null);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [activeDownloads, setActiveDownloads] = useState(new Set());

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

  // Fetch local models
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

  // Fetch model recommendations
  const fetchModelRecommendations = useCallback(async () => {
    try {
      const response = await localModelApi.fetchModelRecommendations();
      setModelRecommendations(response.models || []);
      return response.models || [];
    } catch (error) {
      console.error("Error fetching model recommendations:", error);
      setModelRecommendations([]);
      return [];
    }
  }, []);

  // Fetch Ollama models
  const fetchOllamaModels = useCallback(async () => {
    try {
      const response = await localModelApi.fetchOllamaModels();
      setOllamaModels(response || []);
      return response || [];
    } catch (error) {
      console.error("Error fetching Ollama models:", error);
      setOllamaModels([]);
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

  // Search models
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
      setRepoFiles([]);
      return [];
    }

    setLoading(true);
    try {
      const response = await localModelApi.getRepoFiles(repoId);
      setRepoFiles(response.files || []);
      return response.files || [];
    } catch (error) {
      console.error("Error fetching repo files:", error);
      setRepoFiles([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Pull Ollama model
  const pullOllamaModel = useCallback(async (modelName) => {
    setPullingModel(modelName);
    try {
      await localModelApi.pullOllamaModel(modelName);
      await Promise.all([fetchLocalModels(), fetchOllamaModels()]);
      toast({
        title: "Success",
        description: `Model ${modelName} downloaded successfully`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error pulling model:", error);
      toast({
        title: "Error",
        description: `Failed to download ${modelName}: ${error.message}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setPullingModel(null);
    }
  }, [fetchLocalModels, fetchOllamaModels, toast]);

  // Download model
  const downloadModel = useCallback(async (repoId, filename) => {
    const downloadId = `${repoId}:${filename}`;
    setActiveDownloads(prev => new Set([...prev, downloadId]));

    try {
      const response = await localModelApi.downloadModel(repoId, filename);

      // Start progress polling if download ID is returned
      if (response.download_id) {
        pollDownloadProgress(response.download_id);
      }

      await fetchLocalModels();

      toast({
        title: "Success",
        description: "Model download started successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error downloading model:", error);
      setActiveDownloads(prev => {
        const newSet = new Set(prev);
        newSet.delete(downloadId);
        return newSet;
      });
      toast({
        title: "Error",
        description: `Failed to download model: ${error.message}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [fetchLocalModels, toast]);

  // Delete model
  const deleteModel = useCallback(async (modelName) => {
    try {
      await localModelApi.deleteModel(modelName);
      await fetchLocalModels();
      toast({
        title: "Success",
        description: `Model ${modelName} deleted successfully`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error deleting model:", error);
      toast({
        title: "Error",
        description: `Failed to delete ${modelName}: ${error.message}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [fetchLocalModels, toast]);

  // Poll download progress
  const pollDownloadProgress = useCallback((downloadId) => {
    const interval = setInterval(async () => {
      try {
        const progress = await localModelApi.getDownloadProgress(downloadId);

        setDownloadProgress(prev => ({
          ...prev,
          [downloadId]: progress
        }));

        // Stop polling if download is complete or failed
        if (progress.status === 'completed' || progress.status === 'failed') {
          clearInterval(interval);
          setActiveDownloads(prev => {
            const newSet = new Set(prev);
            newSet.delete(downloadId);
            return newSet;
          });

          if (progress.status === 'completed') {
            await fetchLocalModels();
            toast({
              title: "Success",
              description: "Model download completed",
              status: "success",
              duration: 3000,
              isClosable: true,
            });
          } else if (progress.status === 'failed') {
            toast({
              title: "Error",
              description: `Model download failed: ${progress.error}`,
              status: "error",
              duration: 5000,
              isClosable: true,
            });
          }
        }
      } catch (error) {
        console.error("Error polling download progress:", error);
        clearInterval(interval);
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [fetchLocalModels, toast]);

  // Cancel download
  const cancelDownload = useCallback(async (downloadId) => {
    try {
      await localModelApi.cancelDownload(downloadId);
      setActiveDownloads(prev => {
        const newSet = new Set(prev);
        newSet.delete(downloadId);
        return newSet;
      });
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[downloadId];
        return newProgress;
      });
    } catch (error) {
      console.error("Error cancelling download:", error);
      toast({
        title: "Error",
        description: "Failed to cancel download",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [toast]);

  // Get filtered recommendations based on system specs
  const getFilteredRecommendations = useCallback(() => {
    if (!systemSpecs || !modelRecommendations.length) {
      return modelRecommendations;
    }

    // Filter based on RAM and other specs
    return modelRecommendations.filter(model => {
      if (model.min_ram_gb && systemSpecs.total_memory_gb) {
        return systemSpecs.total_memory_gb >= model.min_ram_gb;
      }
      return true;
    });
  }, [systemSpecs, modelRecommendations]);

  // Check if model is compatible with system
  const checkModelCompatibility = useCallback(async (modelName) => {
    if (!systemSpecs) return null;

    try {
      const response = await localModelApi.validateModelCompatibility(modelName, systemSpecs);
      return response;
    } catch (error) {
      console.error("Error checking model compatibility:", error);
      return null;
    }
  }, [systemSpecs]);

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        fetchSystemSpecs(),
        fetchLocalModels(),
        fetchModelRecommendations(),
        fetchOllamaModels(),
        checkLocalStatus(),
      ]);
    };

    initializeData();
  }, [
    fetchSystemSpecs,
    fetchLocalModels,
    fetchModelRecommendations,
    fetchOllamaModels,
    checkLocalStatus,
  ]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchLocalModels(),
        fetchOllamaModels(),
        checkLocalStatus(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [fetchLocalModels, fetchOllamaModels, checkLocalStatus]);

  return {
    // State
    models,
    searchResults,
    loading,
    searchQuery,
    setSearchQuery,
    selectedRepo,
    setSelectedRepo,
    repoFiles,
    localStatus,
    systemSpecs,
    modelRecommendations,
    pullingModel,
    ollamaModels,
    downloadProgress,
    activeDownloads,

    // Actions
    searchModels,
    fetchRepoFiles,
    pullOllamaModel,
    downloadModel,
    deleteModel,
    cancelDownload,
    refreshData,
    checkModelCompatibility,

    // Computed values
    filteredRecommendations: getFilteredRecommendations(),
  };
};
