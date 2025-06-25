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
} from "react-icons/fa";
import { InfoIcon } from "@chakra-ui/icons";
import { settingsService } from "../../utils/settings/settingsUtils";
import { SPECIALTIES } from "../../utils/constants/index.js";
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
};

const STEP_TITLES = {
    [STEPS.PERSONAL]: "Personal Information",
    [STEPS.LLM]: "Language Model Setup",
    [STEPS.TRANSCRIPTION]: "Transcription Setup",
};

const STEP_DESCRIPTIONS = {
    [STEPS.PERSONAL]: "Tell us about yourself to personalize your experience",
    [STEPS.LLM]: "Configure your AI language model for medical assistance",
    [STEPS.TRANSCRIPTION]:
        "Set up voice transcription (optional but recommended)",
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
        process.env.REACT_APP_OLLAMA_BASE_URL || "http://localhost:11434",
    );
    const [primaryModel, setPrimaryModel] = useState("");
    const [availableModels, setAvailableModels] = useState([]);

    // Whisper Configuration
    const [whisperBaseUrl, setWhisperBaseUrl] = useState(
        process.env.REACT_APP_WHISPER_BASE_URL || "http://localhost:8080",
    );
    const [whisperModel, setWhisperModel] = useState("");
    const [availableWhisperModels, setAvailableWhisperModels] = useState([]);
    const [whisperModelListAvailable, setWhisperModelListAvailable] =
        useState(false);

    // Loading states
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingLLMModels, setIsFetchingLLMModels] = useState(false);
    const [isFetchingWhisperModels, setIsFetchingWhisperModels] =
        useState(false);

    const fetchLLMModelsCallback = useCallback(async () => {
        if (!llmBaseUrl || !llmProvider) {
            setAvailableModels([]);
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
        } catch (error) {
            toast({
                title: "Error fetching LLM models",
                description:
                    error.message ||
                    "Could not connect or provider returned an error.",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
            setAvailableModels([]);
        } finally {
            setIsFetchingLLMModels(false);
        }
    }, [llmBaseUrl, llmProvider, toast]);

    useEffect(() => {
        if (currentStep === STEPS.LLM) {
            fetchLLMModelsCallback();
        }
    }, [fetchLLMModelsCallback, currentStep]);

    const fetchWhisperModelsCallback = useCallback(async () => {
        if (!whisperBaseUrl) {
            setAvailableWhisperModels([]);
            setWhisperModelListAvailable(false);
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
        } catch (error) {
            toast({
                title: "Error fetching Whisper models",
                description:
                    error.message ||
                    "Could not connect or provider returned an error.",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
            setAvailableWhisperModels([]);
            setWhisperModelListAvailable(false);
        } finally {
            setIsFetchingWhisperModels(false);
        }
    }, [whisperBaseUrl, toast]);

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

    const canProceedToNext = () => {
        switch (currentStep) {
            case STEPS.PERSONAL:
                return validatePersonalStep();
            case STEPS.LLM:
                return validateLLMStep();
            case STEPS.TRANSCRIPTION:
                return validateTranscriptionStep();
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (!canProceedToNext()) {
            let message = "";
            switch (currentStep) {
                case STEPS.PERSONAL:
                    message =
                        "Please enter your name and select your specialty.";
                    break;
                case STEPS.LLM:
                    message = "Please select a primary model.";
                    break;
                case STEPS.TRANSCRIPTION:
                    message =
                        "Please configure the Whisper model if you've entered a URL.";
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

        if (currentStep < STEPS.TRANSCRIPTION) {
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
            let currentUserSettings = {};
            await settingsService.fetchUserSettings((data) => {
                currentUserSettings = data;
            });
            const userSettingsToSave = {
                ...currentUserSettings,
                name,
                specialty,
            };
            await settingsService.saveUserSettings(userSettingsToSave);

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

            await settingsService.markSplashCompleted();
            toast({
                title: "Setup Complete!",
                description: "Your initial settings have been saved.",
                status: "success",
                duration: 3000,
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
                            <InfoIcon
                                boxSize={3}
                                color={currentColors.textSecondary}
                            />
                        </Tooltip>
                    </HStack>
                    <Input
                        placeholder="Dr. Ada Lovelace"
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
                            <InfoIcon
                                boxSize={3}
                                color={currentColors.textSecondary}
                            />
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
                            <InfoIcon
                                boxSize={3}
                                color={currentColors.textSecondary}
                            />
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
                            <InfoIcon
                                boxSize={3}
                                color={currentColors.textSecondary}
                            />
                        </Tooltip>
                    </HStack>
                    <Input
                        placeholder={
                            llmProvider === "openai"
                                ? "e.g., https://api.openai.com/v1"
                                : "e.g., http://localhost:11434"
                        }
                        value={llmBaseUrl}
                        onChange={(e) => setLlmBaseUrl(e.target.value)}
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
                            <InfoIcon
                                boxSize={3}
                                color={currentColors.textSecondary}
                            />
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
                        isDisabled={
                            isFetchingLLMModels || availableModels.length === 0
                        }
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
                            <Spinner
                                size="xs"
                                mr={2}
                                color={currentColors.primaryButton}
                            />
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
                                No models found. Please check the URL and ensure
                                your server is running.
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
                    <Text
                        fontSize="sm"
                        color={currentColors.textSecondary}
                        mb={2}
                    >
                        <strong>Note:</strong> Voice transcription is optional
                        but highly recommended for hands-free operation during
                        patient consultations.
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
                            <InfoIcon
                                boxSize={3}
                                color={currentColors.textSecondary}
                            />
                        </Tooltip>
                    </HStack>
                    <Input
                        placeholder="e.g., http://localhost:8080"
                        value={whisperBaseUrl}
                        onChange={(e) => setWhisperBaseUrl(e.target.value)}
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
                                <InfoIcon
                                    boxSize={3}
                                    color={currentColors.textSecondary}
                                />
                            </Tooltip>
                        </HStack>
                        {whisperModelListAvailable &&
                        availableWhisperModels.length > 0 ? (
                            <Select
                                placeholder="Select Whisper model"
                                value={whisperModel}
                                onChange={(e) =>
                                    setWhisperModel(e.target.value)
                                }
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
                                onChange={(e) =>
                                    setWhisperModel(e.target.value)
                                }
                                isDisabled={isFetchingWhisperModels}
                                className="input-style"
                                size="md"
                            />
                        )}
                        {isFetchingWhisperModels && (
                            <Flex align="center" mt={2}>
                                <Spinner
                                    size="xs"
                                    mr={2}
                                    color={currentColors.primaryButton}
                                />
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

    const renderCurrentStep = () => {
        switch (currentStep) {
            case STEPS.PERSONAL:
                return renderPersonalStep();
            case STEPS.LLM:
                return renderLLMStep();
            case STEPS.TRANSCRIPTION:
                return renderTranscriptionStep();
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
                w={{ base: "100%", sm: "90%", md: "600px" }}
                maxW="600px"
                position="relative"
                overflow="hidden"
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
                        <Image
                            src="/logo.webp"
                            alt="Phlox Logo"
                            width="60px"
                            mb={3}
                        />
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
                            value={((currentStep + 1) / 3) * 100}
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
                            Step {currentStep + 1} of 3
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
                                currentStep ===
                                STEPS.TRANSCRIPTION ? undefined : (
                                    <FaArrowRight />
                                )
                            }
                            onClick={handleNext}
                            isLoading={isLoading}
                            loadingText={
                                currentStep === STEPS.TRANSCRIPTION
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
                            {currentStep === STEPS.TRANSCRIPTION
                                ? "Complete Setup"
                                : "Next"}
                        </Button>
                    </MotionFlex>
                </MotionVStack>
            </MotionBox>
        </Flex>
    );
};

export default SplashScreen;
