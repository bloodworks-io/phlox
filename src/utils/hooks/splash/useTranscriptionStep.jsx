import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { SPLASH_STEPS } from "../../../components/common/splash/constants";
import { validateTranscriptionStep } from "../../../utils/splash/validators";
import { settingsService } from "../../../utils/settings/settingsUtils";
import { localModelApi } from "../../api/localModelApi";

export const useTranscriptionStep = (currentStep, inferenceMode = "remote") => {
  const toast = useToast();

  // Remote mode state
  const [whisperBaseUrl, setWhisperBaseUrl] = useState(
    import.meta.env.VITE_WHISPER_BASE_URL || "http://localhost:8080",
  );
  const [whisperModel, setWhisperModel] = useState("");
  const [availableWhisperModels, setAvailableWhisperModels] = useState([]);
  const [whisperModelListAvailable, setWhisperModelListAvailable] =
    useState(false);
  const [whisperUrlValidated, setWhisperUrlValidated] = useState(false);
  const [lastValidatedWhisperUrl, setLastValidatedWhisperUrl] = useState("");
  const [isFetchingWhisperModels, setIsFetchingWhisperModels] = useState(false);

  // Local mode state
  const [localWhisperModels, setLocalWhisperModels] = useState([]);
  const [downloadedWhisperModels, setDownloadedWhisperModels] = useState([]);
  const [localWhisperModel, setLocalWhisperModel] = useState("base");
  const [isDownloadingWhisper, setIsDownloadingWhisper] = useState(false);
  const [downloadingWhisperModelId, setDownloadingWhisperModelId] =
    useState(null);
  const [whisperDownloadProgress, setWhisperDownloadProgress] = useState(0);

  // Fetch remote Whisper models
  const fetchWhisperModels = useCallback(async () => {
    // Only fetch remote models if in remote mode
    if (inferenceMode === "local") return;

    if (!whisperBaseUrl) {
      setAvailableWhisperModels([]);
      setWhisperModelListAvailable(false);
      setWhisperUrlValidated(false);
      setLastValidatedWhisperUrl("");
      return;
    }

    if (whisperUrlValidated && whisperBaseUrl === lastValidatedWhisperUrl) {
      return;
    }

    setIsFetchingWhisperModels(true);
    try {
      let models = [];
      let listAvailable = false;
      await settingsService.fetchWhisperModels(
        whisperBaseUrl,
        (fetchedModels) => {
          models = fetchedModels;
        },
        (isListAvailable) => {
          listAvailable = isListAvailable;
        },
      );
      setAvailableWhisperModels(models);
      setWhisperModelListAvailable(listAvailable);

      setWhisperUrlValidated(true);
      setLastValidatedWhisperUrl(whisperBaseUrl);
    } catch (error) {
      toast({
        title: "Error fetching Whisper models",
        description:
          error.message || "Could not connect or provider returned an error.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      setAvailableWhisperModels([]);
      setWhisperModelListAvailable(false);
      setWhisperUrlValidated(false);
      setLastValidatedWhisperUrl("");
    } finally {
      setIsFetchingWhisperModels(false);
    }
  }, [
    whisperBaseUrl,
    toast,
    whisperUrlValidated,
    lastValidatedWhisperUrl,
    inferenceMode,
  ]);

  // Fetch local Whisper models
  const fetchLocalWhisperModels = useCallback(async () => {
    // Only fetch local models if in local mode
    if (inferenceMode === "remote") return;

    try {
      // Fetch available Whisper models
      const availableResponse =
        await localModelApi.fetchAvailableWhisperModels();
      setLocalWhisperModels(availableResponse.models || []);

      // Fetch downloaded Whisper models
      const downloadedResponse =
        await localModelApi.fetchDownloadedWhisperModels();
      setDownloadedWhisperModels(downloadedResponse.models || []);
    } catch (error) {
      console.error("Error fetching local Whisper models:", error);
      toast({
        title: "Error fetching local Whisper models",
        description:
          error.message || "Could not retrieve local Whisper model list.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [inferenceMode, toast]);

  // Download local Whisper model
  const downloadWhisperModel = useCallback(
    async (modelId) => {
      setIsDownloadingWhisper(true);
      setDownloadingWhisperModelId(modelId);
      setWhisperDownloadProgress(0);

      try {
        // Stream the download
        for await (const progress of localModelApi.streamDownloadWhisperModel(
          modelId,
        )) {
          if (progress.percentage !== undefined) {
            setWhisperDownloadProgress(progress.percentage);
          }
        }

        // Refresh downloaded models after completion
        await fetchLocalWhisperModels();

        toast({
          title: "Download complete",
          description: "Whisper model downloaded successfully.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        toast({
          title: "Download failed",
          description: error.message || "Failed to download Whisper model.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsDownloadingWhisper(false);
        setDownloadingWhisperModelId(null);
        setWhisperDownloadProgress(0);
      }
    },
    [fetchLocalWhisperModels, toast],
  );

  // Check if a Whisper model is downloaded
  const isWhisperModelDownloaded = useCallback(
    (modelId) => {
      return downloadedWhisperModels.some(
        (m) => m.id === modelId || m.name === modelId,
      );
    },
    [downloadedWhisperModels],
  );

  // Validate based on current mode
  const validate = useCallback(() => {
    // Transcription is always optional
    if (inferenceMode === "local") {
      // For local mode, if they selected a model, it must be downloaded
      if (localWhisperModel && !isWhisperModelDownloaded(localWhisperModel)) {
        return false;
      }
      return true; // Or true if they want to skip
    } else {
      // For remote mode, use existing validation
      return validateTranscriptionStep(
        whisperBaseUrl,
        whisperModelListAvailable,
        availableWhisperModels,
        whisperModel,
      );
    }
  }, [
    inferenceMode,
    localWhisperModel,
    isWhisperModelDownloaded,
    whisperBaseUrl,
    whisperModelListAvailable,
    availableWhisperModels,
    whisperModel,
  ]);

  // Get data based on current mode
  const getData = useCallback(() => {
    if (inferenceMode === "local") {
      return {
        whisperBaseUrl: "", // Empty for local
        whisperModel: localWhisperModel,
      };
    } else {
      return {
        whisperBaseUrl,
        whisperModel,
      };
    }
  }, [inferenceMode, localWhisperModel, whisperBaseUrl, whisperModel]);

  // Fetch models when step becomes active or mode changes
  useEffect(() => {
    if (currentStep === SPLASH_STEPS.TRANSCRIPTION) {
      if (inferenceMode === "local") {
        fetchLocalWhisperModels();
      } else {
        fetchWhisperModels();
      }
    }
  }, [fetchWhisperModels, fetchLocalWhisperModels, currentStep, inferenceMode]);

  return {
    // Remote mode
    whisperBaseUrl,
    setWhisperBaseUrl,
    whisperModel,
    setWhisperModel,
    availableWhisperModels,
    whisperModelListAvailable,
    isFetchingWhisperModels,
    fetchWhisperModels,

    // Local mode
    localWhisperModels,
    downloadedWhisperModels,
    localWhisperModel,
    setLocalWhisperModel,
    isDownloadingWhisper,
    downloadingWhisperModelId,
    whisperDownloadProgress,
    downloadWhisperModel,
    isWhisperModelDownloaded,

    // Shared
    validate,
    getData,
  };
};
