import { useState, useEffect, useCallback } from "react";
import {
  VStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  HStack,
  Tooltip,
  InfoIcon,
  Flex,
  Spinner,
  Text,
} from "@chakra-ui/icons";
import { motion } from "framer-motion";
import { useToast } from "@chakra-ui/react";
import { SPLASH_STEPS } from "../constants";
import { stepVariants } from "../constants";
import { validateLLMStep } from "../../../../utils/splash/validators";
import { settingsService } from "../../../../utils/settings/settingsUtils";

const MotionVStack = motion(VStack);

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

export const LLMStep = ({
  llmProvider,
  setLlmProvider,
  llmBaseUrl,
  setLlmBaseUrl,
  primaryModel,
  setPrimaryModel,
  availableModels,
  isFetchingLLMModels,
  fetchLLMModels,
  currentColors,
}) => (
  <MotionVStack
    key="llm"
    variants={stepVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    spacing={6}
    w="100%"
  >
    <VStack spacing={4} w="100%">
      <FormControl>
        <HStack>
          <FormLabel
            color={currentColors.textSecondary}
            sx={{
              fontFamily: '"Roboto", sans-serif',
              fontSize: "sm",
              fontWeight: "500",
            }}
          >
            LLM Provider
          </FormLabel>
          <Tooltip
            label="Choose between Ollama (local models) or OpenAI-compatible APIs (like OpenAI, Anthropic, etc.)"
            placement="top"
            hasArrow
            fontSize="xs"
            bg="gray.700"
            color="white"
          >
            <InfoIcon boxSize={3} color={currentColors.textSecondary} />
          </Tooltip>
        </HStack>
        <Select
          value={llmProvider}
          onChange={(e) => setLlmProvider(e.target.value)}
          className="input-style"
          size="md"
        >
          <option value="ollama">Ollama (Local)</option>
          <option value="openai">OpenAI-compatible API</option>
        </Select>
      </FormControl>

      <FormControl>
        <HStack>
          <FormLabel
            color={currentColors.textSecondary}
            sx={{
              fontFamily: '"Roboto", sans-serif',
              fontSize: "sm",
              fontWeight: "500",
            }}
          >
            LLM Base URL
          </FormLabel>
          <Tooltip
            label={
              llmProvider === "ollama"
                ? "The URL where your Ollama server is running (usually http://localhost:11434)"
                : "The API endpoint for your OpenAI-compatible service"
            }
            placement="top"
            hasArrow
            fontSize="xs"
            bg="gray.700"
            color="white"
          >
            <InfoIcon boxSize={3} color={currentColors.textSecondary} />
          </Tooltip>
        </HStack>
        <Input
          placeholder={
            llmProvider === "openai"
              ? "e.g., https://api.openai.com/v1"
              : "e.g., http://localhost:11434"
          }
          value={llmBaseUrl}
          onChange={(e) => {
            setLlmBaseUrl(e.target.value);
          }}
          onBlur={fetchLLMModels}
          className="input-style"
          size="md"
        />
      </FormControl>

      <FormControl isRequired={availableModels.length > 0}>
        <HStack>
          <FormLabel
            color={currentColors.textSecondary}
            sx={{
              fontFamily: '"Roboto", sans-serif',
              fontSize: "sm",
              fontWeight: "500",
            }}
          >
            Primary Model
          </FormLabel>
          <Tooltip
            label="The main AI model that will handle your medical queries. We recommend models like llama3.1:8b or gpt-4 for medical use."
            placement="top"
            hasArrow
            fontSize="xs"
            bg="gray.700"
            color="white"
          >
            <InfoIcon boxSize={3} color={currentColors.textSecondary} />
          </Tooltip>
        </HStack>
        <Select
          placeholder={
            availableModels.length === 0 && !isFetchingLLMModels
              ? "No models found - check URL and server status"
              : "Select primary model"
          }
          value={primaryModel}
          onChange={(e) => setPrimaryModel(e.target.value)}
          isDisabled={isFetchingLLMModels || availableModels.length === 0}
          className="input-style"
          size="md"
        >
          {availableModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </Select>
        {isFetchingLLMModels && (
          <Flex align="center" mt={2}>
            <Spinner size="xs" mr={2} color={currentColors.primaryButton} />
            <Text
              fontSize="sm"
              color={currentColors.textSecondary}
              sx={{ fontFamily: '"Roboto", sans-serif' }}
            >
              Loading available models...
            </Text>
          </Flex>
        )}
        {!isFetchingLLMModels &&
          availableModels.length === 0 &&
          llmBaseUrl.trim() && (
            <Text
              fontSize="sm"
              color={currentColors.secondaryButton}
              mt={2}
              sx={{ fontFamily: '"Roboto", sans-serif' }}
            >
              No models found. Please check the URL and ensure your server is
              running.
            </Text>
          )}
      </FormControl>
    </VStack>
  </MotionVStack>
);
