import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Heading,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  useToast,
  Text,
  Flex,
  Spinner,
  Image,
  useColorMode,
  HStack,
  Icon,
  Progress,
  Tooltip,
  Badge,
  Textarea,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import {
  FaRobot,
  FaMicrophone,
  FaUserMd,
  FaArrowRight,
  FaArrowLeft,
  FaInfoCircle,
  FaCheckCircle,
  FaFileAlt,
  FaComments,
  FaEnvelope,
} from "react-icons/fa";
import { InfoIcon } from "@chakra-ui/icons";
import { settingsService } from "../../utils/settings/settingsUtils";
import { SPECIALTIES } from "../../utils/constants/index.jsx";
import { colors } from "../../theme/colors";

// Create motion components
const MotionBox = motion(Box);
const MotionVStack = motion(VStack);
const MotionHeading = motion(Heading);
const MotionText = motion(Text);
const MotionButton = motion(Button);
const MotionFlex = motion(Flex);

const STEPS = {
  PERSONAL: 0,
  LLM: 1,
  TRANSCRIPTION: 2,
  TEMPLATES: 3,
  QUICK_CHAT: 4,
  LETTERS: 5,
};

const STEP_TITLES = {
  [STEPS.PERSONAL]: "Personal Information",
  [STEPS.LLM]: "Language Model Setup",
  [STEPS.TRANSCRIPTION]: "Transcription Setup",
  [STEPS.TEMPLATES]: "Choose Default Template",
  [STEPS.QUICK_CHAT]: "Quick Chat Buttons",
  [STEPS.LETTERS]: "Letter Templates",
};

const STEP_DESCRIPTIONS = {
  [STEPS.PERSONAL]: "Tell us about yourself to personalize your experience",
  [STEPS.LLM]: "Configure your AI language model for medical assistance",
  [STEPS.TRANSCRIPTION]:
    "Set up voice transcription (optional but recommended)",
  [STEPS.TEMPLATES]: "Select your preferred clinical note template",
  [STEPS.QUICK_CHAT]: "Customize your quick chat buttons for common queries",
  [STEPS.LETTERS]: "Choose your default letter template for correspondence",
};

// Template descriptions for tooltips
const TEMPLATE_DESCRIPTIONS = {
  phlox_01:
    "Designed for haematology consultations with sections for primary condition, other problems, investigations, current history, impression, and plan.",
  soap_01:
    "Standard SOAP format with Subjective, Objective, Assessment, and Plan sections - ideal for general consultations.",
  progress_01:
    "Perfect for follow-up visits with sections for interval history, current status, and plan.",
};

const SplashScreen = ({ onComplete }) => {
  const { colorMode } = useColorMode();
  const currentColors = colors[colorMode];
  const toast = useToast();

  // Step management
  const [currentStep, setCurrentStep] = useState(STEPS.PERSONAL);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // Personal Information
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");

  // LLM Configuration
  const [llmProvider, setLlmProvider] = useState("ollama");
  const [llmBaseUrl, setLlmBaseUrl] = useState(
    import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434",
  );
  const [primaryModel, setPrimaryModel] = useState("");
  const [availableModels, setAvailableModels] = useState([]);
  const [llmUrlValidated, setLlmUrlValidated] = useState(false);
  const [lastValidatedLlmUrl, setLastValidatedLlmUrl] = useState("");

  // Whisper Configuration
  const [whisperBaseUrl, setWhisperBaseUrl] = useState(
    import.meta.env.VITE_WHISPER_BASE_URL || "http://localhost:8080",
  );
  const [whisperModel, setWhisperModel] = useState("");
  const [availableWhisperModels, setAvailableWhisperModels] = useState([]);
  const [whisperModelListAvailable, setWhisperModelListAvailable] =
    useState(false);
  const [whisperUrlValidated, setWhisperUrlValidated] = useState(false);
  const [lastValidatedWhisperUrl, setLastValidatedWhisperUrl] = useState("");

  // Template Configuration
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // Quick Chat Configuration
  const [quickChat1Title, setQuickChat1Title] = useState("Critique my plan");
  const [quickChat1Prompt, setQuickChat1Prompt] = useState("Critique my plan");
  const [quickChat2Title, setQuickChat2Title] = useState(
    "Any additional investigations",
  );
  const [quickChat2Prompt, setQuickChat2Prompt] = useState(
    "Any additional investigations",
  );
  const [quickChat3Title, setQuickChat3Title] = useState(
    "Any differentials to consider",
  );
  const [quickChat3Prompt, setQuickChat3Prompt] = useState(
    "Any differentials to consider",
  );

  // Letter Template Configuration
  const [availableLetterTemplates, setAvailableLetterTemplates] = useState([]);
  const [selectedLetterTemplate, setSelectedLetterTemplate] = useState("");

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingLLMModels, setIsFetchingLLMModels] = useState(false);
  const [isFetchingWhisperModels, setIsFetchingWhisperModels] = useState(false);
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);
  const [isFetchingLetterTemplates, setIsFetchingLetterTemplates] =
    useState(false);

  // Fetch templates when reaching the templates step
  const fetchTemplates = useCallback(async () => {
    if (currentStep === STEPS.TEMPLATES && availableTemplates.length === 0) {
      setIsFetchingTemplates(true);
      try {
        await settingsService.fetchTemplates((templates) => {
          setAvailableTemplates(templates);
          // Auto-select first template if none selected
          if (!selectedTemplate && templates.length > 0) {
            setSelectedTemplate(templates[0].template_key);
          }
        });
      } catch (error) {
        toast({
          title: "Error fetching templates",
          description: error.message || "Could not load templates",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsFetchingTemplates(false);
      }
    }
  }, [currentStep, availableTemplates.length, selectedTemplate, toast]);

  // Fetch letter templates when reaching the letters step
  const fetchLetterTemplates = useCallback(async () => {
    if (
      currentStep === STEPS.LETTERS &&
      availableLetterTemplates.length === 0
    ) {
      setIsFetchingLetterTemplates(true);
      try {
        const response = await settingsService.fetchLetterTemplates();
        setAvailableLetterTemplates(response.templates || []);
        // Auto-select first template if none selected
        if (
          !selectedLetterTemplate &&
          response.templates &&
          response.templates.length > 0
        ) {
          setSelectedLetterTemplate(response.templates[0].id.toString());
        }
      } catch (error) {
        toast({
          title: "Error fetching letter templates",
          description: error.message || "Could not load letter templates",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsFetchingLetterTemplates(false);
      }
    }
  }, [
    currentStep,
    availableLetterTemplates.length,
    selectedLetterTemplate,
    toast,
  ]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchLetterTemplates();
  }, [fetchLetterTemplates]);

  const fetchLLMModelsCallback = useCallback(async () => {
    if (!llmBaseUrl || !llmProvider) {
      setAvailableModels([]);
      setLlmUrlValidated(false);
      setLastValidatedLlmUrl("");
      return;
    }

    // Skip if URL is already validated and hasn't changed
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

      // Lock the URL if models were successfully fetched
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
    if (currentStep === STEPS.LLM) {
      fetchLLMModelsCallback();
    }
  }, [fetchLLMModelsCallback, currentStep]);

  const fetchWhisperModelsCallback = useCallback(async () => {
    if (!whisperBaseUrl) {
      setAvailableWhisperModels([]);
      setWhisperModelListAvailable(false);
      setWhisperUrlValidated(false);
      setLastValidatedWhisperUrl("");
      return;
    }

    // Skip if URL is already validated and hasn't changed
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

      // Lock the URL if connection was successful
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
    if (currentStep === STEPS.TRANSCRIPTION) {
      fetchWhisperModelsCallback();
    }
  }, [fetchWhisperModelsCallback, currentStep]);

  // Validation functions
  const validatePersonalStep = () => {
    return name.trim() && specialty;
  };

  const validateLLMStep = () => {
    if (availableModels.length > 0 && !primaryModel) {
      return false;
    }
    return true; // Allow proceeding even if no models are available
  };

  const validateTranscriptionStep = () => {
    if (whisperBaseUrl.trim() === "") {
      return true; // Optional step
    }
    if (
      whisperModelListAvailable &&
      availableWhisperModels.length > 0 &&
      !whisperModel
    ) {
      return false;
    }
    if (
      !whisperModelListAvailable &&
      whisperBaseUrl.trim() !== "" &&
      !whisperModel
    ) {
      return false;
    }
    return true;
  };

  const validateTemplatesStep = () => {
    return selectedTemplate !== "";
  };

  const validateQuickChatStep = () => {
    return (
      quickChat1Title.trim() &&
      quickChat1Prompt.trim() &&
      quickChat2Title.trim() &&
      quickChat2Prompt.trim() &&
      quickChat3Title.trim() &&
      quickChat3Prompt.trim()
    );
  };

  const validateLettersStep = () => {
    return selectedLetterTemplate !== "";
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case STEPS.PERSONAL:
        return validatePersonalStep();
      case STEPS.LLM:
        return validateLLMStep();
      case STEPS.TRANSCRIPTION:
        return validateTranscriptionStep();
      case STEPS.TEMPLATES:
        return validateTemplatesStep();
      case STEPS.QUICK_CHAT:
        return validateQuickChatStep();
      case STEPS.LETTERS:
        return validateLettersStep();
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceedToNext()) {
      let message = "";
      switch (currentStep) {
        case STEPS.PERSONAL:
          message = "Please enter your name and select your specialty.";
          break;
        case STEPS.LLM:
          message = "Please select a primary model.";
          break;
        case STEPS.TRANSCRIPTION:
          message =
            "Please configure the Whisper model if you've entered a URL.";
          break;
        case STEPS.TEMPLATES:
          message = "Please select a default template.";
          break;
        case STEPS.QUICK_CHAT:
          message = "Please fill in all quick chat button titles and prompts.";
          break;
        case STEPS.LETTERS:
          message = "Please select a default letter template.";
          break;
      }
      toast({
        title: "Missing Information",
        description: message,
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setCompletedSteps((prev) => new Set([...prev, currentStep]));

    if (currentStep < STEPS.LETTERS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > STEPS.PERSONAL) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Save user settings including quick chat buttons and default letter template
      let currentUserSettings = {};
      await settingsService.fetchUserSettings((data) => {
        currentUserSettings = data;
      });

      const userSettingsToSave = {
        ...currentUserSettings,
        name,
        specialty,
        quick_chat_1_title: quickChat1Title,
        quick_chat_1_prompt: quickChat1Prompt,
        quick_chat_2_title: quickChat2Title,
        quick_chat_2_prompt: quickChat2Prompt,
        quick_chat_3_title: quickChat3Title,
        quick_chat_3_prompt: quickChat3Prompt,
        default_letter_template_id: selectedLetterTemplate
          ? parseInt(selectedLetterTemplate)
          : null,
      };
      await settingsService.saveUserSettings(userSettingsToSave);

      // Save global config
      const currentGlobalConfig = await settingsService.fetchConfig();
      const configToSave = {
        ...currentGlobalConfig,
        LLM_PROVIDER: llmProvider,
        LLM_BASE_URL: llmBaseUrl,
        PRIMARY_MODEL: primaryModel,
        WHISPER_BASE_URL: whisperBaseUrl,
        WHISPER_MODEL: whisperModel,
      };

      if (settingsService.saveGlobalConfig) {
        await settingsService.saveGlobalConfig(configToSave);
      } else {
        console.warn(
          "settingsService.saveGlobalConfig is not defined, falling back to updateConfig.",
        );
        await settingsService.updateConfig(configToSave);
      }

      // Set default template
      if (selectedTemplate) {
        await settingsService.setDefaultTemplate(selectedTemplate, toast);
      }

      await settingsService.markSplashCompleted();
      toast({
        title: "Setup Complete!",
        description:
          "Your initial settings have been saved. You can change any of these settings later in the Settings panel.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      onComplete();
    } catch (error) {
      toast({
        title: "Error Saving Settings",
        description: error.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94],
        when: "beforeChildren",
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  const stepVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut",
      },
    },
    exit: {
      opacity: 0,
      x: -50,
      transition: {
        duration: 0.3,
        ease: "easeIn",
      },
    },
  };

  const getStepIcon = (step) => {
    switch (step) {
      case STEPS.PERSONAL:
        return FaUserMd;
      case STEPS.LLM:
        return FaRobot;
      case STEPS.TRANSCRIPTION:
        return FaMicrophone;
      case STEPS.TEMPLATES:
        return FaFileAlt;
      case STEPS.QUICK_CHAT:
        return FaComments;
      case STEPS.LETTERS:
        return FaEnvelope;
      default:
        return FaInfoCircle;
    }
  };

  const renderPersonalStep = () => (
    <MotionVStack
      key="personal"
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      spacing={6}
      w="100%"
    >
      <VStack spacing={4} w="100%">
        <FormControl isRequired>
          <HStack>
            <FormLabel
              color={currentColors.textSecondary}
              sx={{
                fontFamily: '"Roboto", sans-serif',
                fontSize: "sm",
                fontWeight: "500",
              }}
            >
              Your Name
            </FormLabel>
            <Tooltip
              label="This will be used to personalize your experience and in generated documents"
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
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-style"
            size="md"
          />
        </FormControl>

        <FormControl isRequired>
          <HStack>
            <FormLabel
              color={currentColors.textSecondary}
              sx={{
                fontFamily: '"Roboto", sans-serif',
                fontSize: "sm",
                fontWeight: "500",
              }}
            >
              Your Specialty
            </FormLabel>
            <Tooltip
              label="Your medical specialty helps Phlox provide more relevant assistance and suggestions"
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
            placeholder="Select your specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="input-style"
            size="md"
          >
            {SPECIALTIES.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </Select>
        </FormControl>
      </VStack>
    </MotionVStack>
  );

  const renderLLMStep = () => (
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
              const newUrl = e.target.value;
              setLlmBaseUrl(newUrl);
              // Reset validation if URL changed
              if (newUrl !== lastValidatedLlmUrl) {
                setLlmUrlValidated(false);
              }
            }}
            onBlur={fetchLLMModelsCallback}
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

  const renderTranscriptionStep = () => (
    <MotionVStack
      key="transcription"
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      spacing={6}
      w="100%"
    >
      <VStack spacing={4} w="100%">
        <Box w="100%" p={4} borderRadius="md" className="floating-main">
          <Text fontSize="sm" color={currentColors.textSecondary} mb={2}>
            <strong>Note:</strong> Voice transcription is optional but highly
            recommended for hands-free operation during patient consultations.
          </Text>
        </Box>

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
              Whisper Base URL (Optional)
            </FormLabel>
            <Tooltip
              label="The URL where your Whisper transcription server is running. Leave empty to skip voice transcription setup."
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
            placeholder="e.g., http://localhost:8080"
            value={whisperBaseUrl}
            onChange={(e) => {
              const newUrl = e.target.value;
              setWhisperBaseUrl(newUrl);
              // Reset validation if URL changed
              if (newUrl !== lastValidatedWhisperUrl) {
                setWhisperUrlValidated(false);
              }
            }}
            onBlur={fetchWhisperModelsCallback}
            className="input-style"
            size="md"
          />
        </FormControl>

        {whisperBaseUrl.trim() && (
          <FormControl isRequired>
            <HStack>
              <FormLabel
                color={currentColors.textSecondary}
                sx={{
                  fontFamily: '"Roboto", sans-serif',
                  fontSize: "sm",
                  fontWeight: "500",
                }}
              >
                Whisper Model
              </FormLabel>
              <Tooltip
                label="The Whisper model to use for speech-to-text. Common options include whisper-1, base, small, medium, or large."
                placement="top"
                hasArrow
                fontSize="xs"
                bg="gray.700"
                color="white"
              >
                <InfoIcon boxSize={3} color={currentColors.textSecondary} />
              </Tooltip>
            </HStack>
            {whisperModelListAvailable && availableWhisperModels.length > 0 ? (
              <Select
                placeholder="Select Whisper model"
                value={whisperModel}
                onChange={(e) => setWhisperModel(e.target.value)}
                isDisabled={isFetchingWhisperModels}
                className="input-style"
                size="md"
              >
                {availableWhisperModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                placeholder="Enter model name (e.g., whisper-1, base, small)"
                value={whisperModel}
                onChange={(e) => setWhisperModel(e.target.value)}
                isDisabled={isFetchingWhisperModels}
                className="input-style"
                size="md"
              />
            )}
            {isFetchingWhisperModels && (
              <Flex align="center" mt={2}>
                <Spinner size="xs" mr={2} color={currentColors.primaryButton} />
                <Text
                  fontSize="sm"
                  color={currentColors.textSecondary}
                  sx={{ fontFamily: '"Roboto", sans-serif' }}
                >
                  Loading Whisper models...
                </Text>
              </Flex>
            )}
          </FormControl>
        )}
      </VStack>
    </MotionVStack>
  );

  const renderTemplatesStep = () => (
    <MotionVStack
      key="templates"
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      spacing={6}
      w="100%"
    >
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Choose Your Default Template</AlertTitle>
          <AlertDescription>
            Select a clinical note template that best fits your workflow. You
            can create custom templates and change this setting later in the
            Settings panel.
          </AlertDescription>
        </Box>
      </Alert>

      {isFetchingTemplates ? (
        <Flex align="center" justify="center" py={8}>
          <Spinner size="lg" color={currentColors.primaryButton} />
          <Text ml={4} color={currentColors.textSecondary}>
            Loading templates...
          </Text>
        </Flex>
      ) : (
        <SimpleGrid columns={1} spacing={4} w="100%">
          {availableTemplates.map((template) => (
            <Card
              key={template.template_key}
              cursor="pointer"
              onClick={() => setSelectedTemplate(template.template_key)}
              borderWidth="2px"
              borderColor={
                selectedTemplate === template.template_key
                  ? currentColors.primaryButton
                  : "transparent"
              }
              bg={
                selectedTemplate === template.template_key
                  ? currentColors.surface + "40"
                  : currentColors.surface
              }
              _hover={{
                borderColor: currentColors.primaryButton + "80",
                transform: "translateY(-2px)",
              }}
              transition="all 0.2s"
            >
              <CardHeader pb={2}>
                <HStack justify="space-between">
                  <Heading size="md" color={currentColors.textPrimary}>
                    {template.template_name}
                  </Heading>
                  {selectedTemplate === template.template_key && (
                    <Icon as={FaCheckCircle} color="green.500" />
                  )}
                </HStack>
              </CardHeader>
              <CardBody pt={0}>
                <Text fontSize="sm" color={currentColors.textSecondary} mb={3}>
                  {TEMPLATE_DESCRIPTIONS[template.template_key] ||
                    "A custom template for clinical documentation."}
                </Text>
                <Text
                  fontSize="xs"
                  color={currentColors.textSecondary}
                  fontWeight="medium"
                >
                  Fields:{" "}
                  {template.fields?.map((f) => f.field_name).join(", ") ||
                    "Loading..."}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </MotionVStack>
  );

  const renderQuickChatStep = () => (
    <MotionVStack
      key="quickchat"
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      spacing={6}
      w="100%"
    >
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Customize Quick Chat Buttons</AlertTitle>
          <AlertDescription>
            Set up three quick chat buttons for common queries. These will
            appear in your chat interface for easy access. You can change these
            anytime in Settings.
          </AlertDescription>
        </Box>
      </Alert>

      <VStack spacing={6} w="100%">
        {/* Quick Chat Button 1 */}
        <Box w="100%" p={4} borderRadius="md" className="floating-main">
          <Text fontWeight="medium" mb={3} color={currentColors.textPrimary}>
            Quick Chat Button 1
          </Text>
          <VStack spacing={3}>
            <FormControl isRequired>
              <FormLabel fontSize="sm" color={currentColors.textSecondary}>
                Button Title
              </FormLabel>
              <Input
                placeholder="e.g., Critique my plan"
                value={quickChat1Title}
                onChange={(e) => setQuickChat1Title(e.target.value)}
                className="input-style"
                size="sm"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm" color={currentColors.textSecondary}>
                Prompt
              </FormLabel>
              <Textarea
                placeholder="e.g., Please critique my management plan and suggest any improvements"
                value={quickChat1Prompt}
                onChange={(e) => setQuickChat1Prompt(e.target.value)}
                className="input-style"
                size="sm"
                rows={2}
              />
            </FormControl>
          </VStack>
        </Box>

        {/* Quick Chat Button 2 */}
        <Box w="100%" p={4} borderRadius="md" className="floating-main">
          <Text fontWeight="medium" mb={3} color={currentColors.textPrimary}>
            Quick Chat Button 2
          </Text>
          <VStack spacing={3}>
            <FormControl isRequired>
              <FormLabel fontSize="sm" color={currentColors.textSecondary}>
                Button Title
              </FormLabel>
              <Input
                placeholder="e.g., Additional investigations"
                value={quickChat2Title}
                onChange={(e) => setQuickChat2Title(e.target.value)}
                className="input-style"
                size="sm"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm" color={currentColors.textSecondary}>
                Prompt
              </FormLabel>
              <Textarea
                placeholder="e.g., What additional investigations should I consider for this patient?"
                value={quickChat2Prompt}
                onChange={(e) => setQuickChat2Prompt(e.target.value)}
                className="input-style"
                size="sm"
                rows={2}
              />
            </FormControl>
          </VStack>
        </Box>

        {/* Quick Chat Button 3 */}
        <Box w="100%" p={4} borderRadius="md" className="floating-main">
          <Text fontWeight="medium" mb={3} color={currentColors.textPrimary}>
            Quick Chat Button 3
          </Text>
          <VStack spacing={3}>
            <FormControl isRequired>
              <FormLabel fontSize="sm" color={currentColors.textSecondary}>
                Button Title
              </FormLabel>
              <Input
                placeholder="e.g., Differential diagnoses"
                value={quickChat3Title}
                onChange={(e) => setQuickChat3Title(e.target.value)}
                className="input-style"
                size="sm"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm" color={currentColors.textSecondary}>
                Prompt
              </FormLabel>
              <Textarea
                placeholder="e.g., What other differential diagnoses should I consider for this presentation?"
                value={quickChat3Prompt}
                onChange={(e) => setQuickChat3Prompt(e.target.value)}
                className="input-style"
                size="sm"
                rows={2}
              />
            </FormControl>
          </VStack>
        </Box>
      </VStack>
    </MotionVStack>
  );

  const renderLettersStep = () => (
    <MotionVStack
      key="letters"
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      spacing={6}
      w="100%"
    >
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Choose Default Letter Template</AlertTitle>
          <AlertDescription>
            Select your preferred letter template for generating correspondence.
            You can create custom letter templates and change this setting
            later.
          </AlertDescription>
        </Box>
      </Alert>

      {isFetchingLetterTemplates ? (
        <Flex align="center" justify="center" py={8}>
          <Spinner size="lg" color={currentColors.primaryButton} />
          <Text ml={4} color={currentColors.textSecondary}>
            Loading letter templates...
          </Text>
        </Flex>
      ) : (
        <SimpleGrid columns={1} spacing={4} w="100%">
          {availableLetterTemplates.map((template) => (
            <Card
              key={template.id}
              cursor="pointer"
              onClick={() => setSelectedLetterTemplate(template.id.toString())}
              borderWidth="2px"
              borderColor={
                selectedLetterTemplate === template.id.toString()
                  ? currentColors.primaryButton
                  : "transparent"
              }
              bg={
                selectedLetterTemplate === template.id.toString()
                  ? currentColors.surface + "40"
                  : currentColors.surface
              }
              _hover={{
                borderColor: currentColors.primaryButton + "80",
                transform: "translateY(-2px)",
              }}
              transition="all 0.2s"
            >
              <CardHeader pb={2}>
                <HStack justify="space-between">
                  <Heading size="md" color={currentColors.textPrimary}>
                    {template.name}
                  </Heading>
                  {selectedLetterTemplate === template.id.toString() && (
                    <Icon as={FaCheckCircle} color="green.500" />
                  )}
                </HStack>
              </CardHeader>
              <CardBody pt={0}>
                <Text
                  fontSize="sm"
                  color={currentColors.textSecondary}
                  noOfLines={2}
                >
                  {template.content ||
                    "A template for generating professional correspondence."}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </MotionVStack>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case STEPS.PERSONAL:
        return renderPersonalStep();
      case STEPS.LLM:
        return renderLLMStep();
      case STEPS.TRANSCRIPTION:
        return renderTranscriptionStep();
      case STEPS.TEMPLATES:
        return renderTemplatesStep();
      case STEPS.QUICK_CHAT:
        return renderQuickChatStep();
      case STEPS.LETTERS:
        return renderLettersStep();
      default:
        return null;
    }
  };

  return (
    <Flex
      align="center"
      justify="center"
      minH="100vh"
      className="panels-bg"
      px={4}
      py={8}
    >
      <MotionBox
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        p={{ base: 6, md: 8 }}
        borderRadius="2xl"
        boxShadow="2xl"
        className="panels-bg"
        border={`1px solid ${currentColors.surface}`}
        w={{ base: "100%", sm: "90%", md: "700px" }}
        maxW="700px"
        position="relative"
        overflow="hidden"
        maxH="90vh"
        overflowY="auto"
      >
        {/* Background gradient overlay */}
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          height="120px"
          bgGradient={`linear(to-b, ${currentColors.sidebar.background}15, transparent)`}
          borderRadius="2xl"
          zIndex="0"
        />

        <MotionVStack
          spacing={6}
          align="stretch"
          position="relative"
          zIndex="1"
        >
          {/* Header */}
          <MotionFlex
            variants={itemVariants}
            direction="column"
            align="center"
            mb={4}
          >
            <Image src="/logo.webp" alt="Phlox Logo" width="60px" mb={3} />
            <MotionHeading
              as="h1"
              textAlign="center"
              color={currentColors.textPrimary}
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: ["1.5rem", "1.75rem"],
                fontWeight: "700",
                lineHeight: "1.2",
                marginBottom: "0.5rem",
                letterSpacing: "-0.02em",
              }}
            >
              Welcome to Phlox
            </MotionHeading>
            <MotionText
              textAlign="center"
              fontSize="sm"
              color={currentColors.textSecondary}
              maxW="400px"
              lineHeight="1.6"
              sx={{ fontFamily: '"Roboto", sans-serif' }}
            >
              Let's set up your AI-powered medical assistant
            </MotionText>
          </MotionFlex>

          {/* Progress Bar */}
          <MotionBox variants={itemVariants}>
            <Progress
              value={((currentStep + 1) / 6) * 100}
              colorScheme="blue"
              borderRadius="full"
              size="sm"
              mb={2}
            />
            <Text
              fontSize="xs"
              color={currentColors.textSecondary}
              textAlign="center"
              sx={{ fontFamily: '"Roboto", sans-serif' }}
            >
              Step {currentStep + 1} of 6
            </Text>
          </MotionBox>

          {/* Step Header */}
          <MotionBox variants={itemVariants}>
            <HStack mb={4} align="center" justify="center">
              <Icon
                as={getStepIcon(currentStep)}
                className="pill-box-icons"
                boxSize={5}
              />
              <Heading
                as="h2"
                color={currentColors.textPrimary}
                sx={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: ["1.25rem", "1.5rem"],
                  fontWeight: "600",
                  lineHeight: "1.2",
                }}
              >
                {STEP_TITLES[currentStep]}
              </Heading>
              {completedSteps.has(currentStep) && (
                <Badge colorScheme="green" variant="solid">
                  <Icon as={FaCheckCircle} mr={1} />
                  Complete
                </Badge>
              )}
            </HStack>
            <Text
              textAlign="center"
              fontSize="sm"
              color={currentColors.textSecondary}
              mb={6}
              sx={{ fontFamily: '"Roboto", sans-serif' }}
            >
              {STEP_DESCRIPTIONS[currentStep]}
            </Text>
          </MotionBox>

          {/* Step Content */}
          <Box>{renderCurrentStep()}</Box>

          {/* Navigation Buttons */}
          <MotionFlex
            variants={itemVariants}
            justify="space-between"
            align="center"
            mt={6}
          >
            <Button
              leftIcon={<FaArrowLeft />}
              onClick={handlePrevious}
              isDisabled={currentStep === STEPS.PERSONAL}
              variant="outline"
              size="md"
              className="secondary-button"
            >
              Previous
            </Button>

            <Button
              rightIcon={
                currentStep === STEPS.LETTERS ? undefined : <FaArrowRight />
              }
              onClick={handleNext}
              isLoading={isLoading}
              loadingText={
                currentStep === STEPS.LETTERS
                  ? "Completing setup..."
                  : "Processing..."
              }
              isDisabled={!canProceedToNext()}
              size="md"
              className="switch-mode"
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: "600",
              }}
            >
              {currentStep === STEPS.LETTERS ? "Complete Setup" : "Next"}
            </Button>
          </MotionFlex>
        </MotionVStack>
      </MotionBox>
    </Flex>
  );
};

export default SplashScreen;
