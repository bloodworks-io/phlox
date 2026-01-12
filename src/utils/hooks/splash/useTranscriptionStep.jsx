import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { SPLASH_STEPS } from "../../../components/common/splash/constants";
import { validateTranscriptionStep } from "../../../utils/splash/validators";
import { settingsService } from "../../../utils/settings/settingsUtils";

export const useTranscriptionStep = (currentStep) => {
  const toast = useToast();
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

  const fetchWhisperModels = useCallback(async () => {
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
  }, [whisperBaseUrl, toast, whisperUrlValidated, lastValidatedWhisperUrl]);

  useEffect(() => {
    if (currentStep === SPLASH_STEPS.TRANSCRIPTION) {
      fetchWhisperModels();
    }
  }, [fetchWhisperModels, currentStep]);

  return {
    whisperBaseUrl,
    setWhisperBaseUrl,
    whisperModel,
    setWhisperModel,
    availableWhisperModels,
    whisperModelListAvailable,
    isFetchingWhisperModels,
    fetchWhisperModels,
    validate: () =>
      validateTranscriptionStep(
        whisperBaseUrl,
        whisperModelListAvailable,
        availableWhisperModels,
        whisperModel,
      ),
    getData: () => ({ whisperBaseUrl, whisperModel }),
  };
};
