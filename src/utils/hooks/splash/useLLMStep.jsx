import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { SPLASH_STEPS } from "../../../components/common/splash/constants";
import { validateLLMStep } from "../../../utils/splash/validators";
import { settingsService } from "../../../utils/settings/settingsUtils";

export const useLLMStep = (currentStep) => {
  const toast = useToast();
  const [llmProvider, setLlmProvider] = useState("ollama");
  const [llmBaseUrl, setLlmBaseUrl] = useState(
    import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434",
  );
  const [primaryModel, setPrimaryModel] = useState("");
  const [availableModels, setAvailableModels] = useState([]);
  const [llmUrlValidated, setLlmUrlValidated] = useState(false);
  const [lastValidatedLlmUrl, setLastValidatedLlmUrl] = useState("");
  const [isFetchingLLMModels, setIsFetchingLLMModels] = useState(false);

  const fetchLLMModels = useCallback(async () => {
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
  }, [llmBaseUrl, llmProvider, toast, llmUrlValidated, lastValidatedLlmUrl]);

  useEffect(() => {
    if (currentStep === SPLASH_STEPS.LLM) {
      fetchLLMModels();
    }
  }, [fetchLLMModels, currentStep]);

  return {
    llmProvider,
    setLlmProvider,
    llmBaseUrl,
    setLlmBaseUrl,
    primaryModel,
    setPrimaryModel,
    availableModels,
    isFetchingLLMModels,
    fetchLLMModels,
    validate: () => validateLLMStep(availableModels, primaryModel),
    getData: () => ({ llmProvider, llmBaseUrl, primaryModel }),
  };
};
