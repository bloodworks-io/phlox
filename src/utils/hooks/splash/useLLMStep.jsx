import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { SPLASH_STEPS } from "../../../components/common/splash/constants";
import { validateLLMStep } from "../../../utils/splash/validators";
import { settingsService } from "../../../utils/settings/settingsUtils";
import { isTauri } from "../../helpers/apiConfig";
import { localModelApi } from "../../api/localModelApi";

export const useLLMStep = (currentStep) => {
  const toast = useToast();

  // Desktop detection
  const isDesktop = isTauri();

  // Inference mode: local or remote
  const [inferenceMode, setInferenceMode] = useState(
    isDesktop ? "local" : "remote",
  );

  // Remote mode state
  const [llmProvider, setLlmProvider] = useState("ollama");
  const [llmBaseUrl, setLlmBaseUrl] = useState(
    import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434",
  );
  const [primaryModel, setPrimaryModel] = useState("");
  const [availableModels, setAvailableModels] = useState([]);
  const [llmUrlValidated, setLlmUrlValidated] = useState(false);
  const [lastValidatedLlmUrl, setLastValidatedLlmUrl] = useState("");
  const [isFetchingLLMModels, setIsFetchingLLMModels] = useState(false);

  // Local mode state
  const [localAvailableModels, setLocalAvailableModels] = useState([]);
  const [localDownloadedModels, setLocalDownloadedModels] = useState([]);
  const [primaryLocalModel, setPrimaryLocalModel] = useState("");
  const [isDownloadingLocal, setIsDownloadingLocal] = useState(false);
  const [downloadingModelId, setDownloadingModelId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Fetch remote LLM models
  const fetchLLMModels = useCallback(async () => {
    if (inferenceMode === "local") return;

    if (!llmBaseUrl || !llmProvider) {
      setAvailableModels([]);
      setLlmUrlValidated(false);
      setLastValidatedLlmUrl("");
      return;
    }

    if (llmUrlValidated && llmBaseUrl === lastValidatedLlmUrl) {
      return;
    }

    setIsFetchingLLMModels(true);
    try {
      let models = [];
      await settingsService.fetchLLMModels(
        { LLM_BASE_URL: llmBaseUrl, LLM_PROVIDER: llmProvider },
        (fetchedModels) => {
          models = fetchedModels;
        },
      );
      setAvailableModels(models);

      if (models.length > 0) {
        setLlmUrlValidated(true);
        setLastValidatedLlmUrl(llmBaseUrl);
      } else {
        setLlmUrlValidated(false);
        setLastValidatedLlmUrl("");
      }
    } catch (error) {
      toast({
        title: "Error fetching LLM models",
        description:
          error.message || "Could not connect or provider returned an error.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      setAvailableModels([]);
      setLlmUrlValidated(false);
      setLastValidatedLlmUrl("");
    } finally {
      setIsFetchingLLMModels(false);
    }
  }, [
    llmBaseUrl,
    llmProvider,
    toast,
    llmUrlValidated,
    lastValidatedLlmUrl,
    inferenceMode,
  ]);

  // Fetch local models
  const fetchLocalModels = useCallback(async () => {
    if (inferenceMode === "remote") return;

    try {
      // Fetch available pre-configured models
      const availableResponse =
        await localModelApi.fetchAvailableLlmModels();
      setLocalAvailableModels(availableResponse.models || []);

      // Fetch downloaded models
      const downloadedResponse = await localModelApi.fetchLocalModels();
      setLocalDownloadedModels(downloadedResponse.models || []);

      // Auto-select the first downloaded model if none selected
      if (
        !primaryLocalModel &&
        downloadedResponse.models &&
        downloadedResponse.models.length > 0
      ) {
        setPrimaryLocalModel(downloadedResponse.models[0].filename);
      }
    } catch (error) {
      console.error("Error fetching local models:", error);
      toast({
        title: "Error fetching local models",
        description: error.message || "Could not retrieve local model list.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [inferenceMode, primaryLocalModel, toast]);

  // Download local model with progress
  const downloadLocalModel = useCallback(
    async (modelId) => {
      setIsDownloadingLocal(true);
      setDownloadingModelId(modelId);
      setDownloadProgress(0);

      try {
        // Stream the download
        for await (const progress of localModelApi.streamDownloadLlmModel(
          modelId,
        )) {
          if (progress.percentage !== undefined) {
            setDownloadProgress(progress.percentage);
          }
        }

        // Refresh downloaded models after completion
        await fetchLocalModels();

        toast({
          title: "Download complete",
          description: "Model downloaded successfully.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        toast({
          title: "Download failed",
          description: error.message || "Failed to download model.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsDownloadingLocal(false);
        setDownloadingModelId(null);
        setDownloadProgress(0);
      }
    },
    [fetchLocalModels, toast],
  );

  // Check if a local model is downloaded
  const isLocalModelDownloaded = useCallback(
    (modelId) => {
      const model = localAvailableModels.find((m) => m.id === modelId);
      if (!model) return false;
      return localDownloadedModels.some(
        (m) => m.filename === model.filename,
      );
    },
    [localAvailableModels, localDownloadedModels],
  );

  // Switch inference mode
  const handleSetInferenceMode = useCallback((mode) => {
    setInferenceMode(mode);
    // Clear selections when switching modes
    if (mode === "local") {
      setPrimaryModel("");
    } else {
      setPrimaryLocalModel("");
    }
  }, []);

  // Validate based on current mode
  const validate = useCallback(() => {
    if (inferenceMode === "local") {
      // For local mode, validate that a local model is selected AND downloaded
      if (!primaryLocalModel) return false;
      // Check if the selected model is actually downloaded
      const model = localAvailableModels.find(
        (m) => m.filename === primaryLocalModel,
      );
      if (!model) return false;
      return localDownloadedModels.some((m) => m.filename === model.filename);
    } else {
      // For remote mode, use existing validation
      return validateLLMStep(availableModels, primaryModel);
    }
  }, [
    inferenceMode,
    primaryLocalModel,
    localAvailableModels,
    localDownloadedModels,
    availableModels,
    primaryModel,
  ]);

  // Get data based on current mode
  const getData = useCallback(() => {
    if (inferenceMode === "local") {
      return {
        llmProvider: "local",
        llmBaseUrl: "",
        primaryModel: primaryLocalModel,
        inferenceMode,
        localModelId: primaryLocalModel,
      };
    } else {
      return {
        llmProvider,
        llmBaseUrl,
        primaryModel,
        inferenceMode,
        localModelId: null,
      };
    }
  }, [
    inferenceMode,
    llmProvider,
    llmBaseUrl,
    primaryModel,
    primaryLocalModel,
  ]);

  // Fetch models when step becomes active or mode changes
  useEffect(() => {
    if (currentStep === SPLASH_STEPS.LLM) {
      if (inferenceMode === "local") {
        fetchLocalModels();
      } else {
        fetchLLMModels();
      }
    }
  }, [fetchLLMModels, fetchLocalModels, currentStep, inferenceMode]);

  return {
    // Inference mode
    inferenceMode,
    setInferenceMode: handleSetInferenceMode,
    isDesktop,

    // Remote mode
    llmProvider,
    setLlmProvider,
    llmBaseUrl,
    setLlmBaseUrl,
    primaryModel,
    setPrimaryModel,
    availableModels,
    isFetchingLLMModels,
    fetchLLMModels,

    // Local mode
    localAvailableModels,
    localDownloadedModels,
    primaryLocalModel,
    setPrimaryLocalModel,
    isDownloadingLocal,
    downloadingModelId,
    downloadProgress,
    downloadLocalModel,
    isLocalModelDownloaded,

    // Shared
    validate,
    getData,
  };
};
