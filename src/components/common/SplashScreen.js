// src/components/common/SplashScreen.js
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
} from "@chakra-ui/react";
// Import motion from framer-motion
import { motion } from "framer-motion";
import { settingsService } from "../../utils/settings/settingsUtils";
import { SPECIALTIES } from "../../utils/constants/index.js";

// Create motion components
const MotionBox = motion(Box);
const MotionVStack = motion(VStack);
// const MotionFormControl = motion(FormControl); // Not used directly, sections are MotionBox
const MotionHeading = motion(Heading);
const MotionText = motion(Text);
const MotionButton = motion(Button);

const SplashScreen = ({ onComplete }) => {
    const toast = useToast();
    const [name, setName] = useState("");
    const [specialty, setSpecialty] = useState("");

    const [llmProvider, setLlmProvider] = useState("ollama");
    const [llmBaseUrl, setLlmBaseUrl] = useState(
        process.env.REACT_APP_OLLAMA_BASE_URL || "http://localhost:11434",
    );
    const [primaryModel, setPrimaryModel] = useState("");
    const [availableModels, setAvailableModels] = useState([]);

    const [whisperBaseUrl, setWhisperBaseUrl] = useState(
        process.env.REACT_APP_WHISPER_BASE_URL || "http://localhost:8080",
    );
    const [whisperModel, setWhisperModel] = useState("");
    const [availableWhisperModels, setAvailableWhisperModels] = useState([]);
    const [whisperModelListAvailable, setWhisperModelListAvailable] =
        useState(false);

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
        fetchLLMModelsCallback();
    }, [fetchLLMModelsCallback]);

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
        fetchWhisperModelsCallback();
    }, [fetchWhisperModelsCallback]);

    const handleContinue = async () => {
        if (!name.trim() || !specialty) {
            toast({
                title: "Missing Information",
                description: "Please enter your name and specialty.",
                status: "warning",
                duration: 3000,
                isClosable: true,
            });
            return;
        }
        if (availableModels.length > 0 && !primaryModel) {
            toast({
                title: "Missing Model",
                description: "Please select a Primary Model.",
                status: "warning",
                duration: 3000,
                isClosable: true,
            });
            return;
        }
        if (
            whisperModelListAvailable &&
            availableWhisperModels.length > 0 &&
            !whisperModel
        ) {
            toast({
                title: "Missing Whisper Model",
                description: "Please select a Whisper Model.",
                status: "warning",
                duration: 3000,
                isClosable: true,
            });
            return;
        }
        if (
            !whisperModel &&
            (!whisperModelListAvailable ||
                availableWhisperModels.length === 0) &&
            whisperBaseUrl.trim() !== ""
        ) {
            toast({
                title: "Missing Whisper Model Name",
                description:
                    "Please enter the Whisper model name manually as the API does not provide a list.",
                status: "warning",
                duration: 4000,
                isClosable: true,
            });
            return;
        }
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
                // This fallback might indicate an issue if saveGlobalConfig was expected to be defined in settingsUtils.js
                console.warn(
                    "settingsService.saveGlobalConfig is not defined, falling back to updateConfig. This might not save to backend.",
                );
                await settingsService.updateConfig(configToSave); // Ensure updateConfig actually saves if this path is taken.
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
        hidden: { opacity: 0, scale: 0.95 },
        visible: {
            opacity: 1,
            scale: 1,
            transition: {
                duration: 0.4,
                ease: "easeInOut",
                when: "beforeChildren",
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4, ease: "easeOut" },
        },
    };

    return (
        <Flex align="center" justify="center" minH="100vh" bg="gray.100">
            <MotionBox
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                p={8}
                borderWidth={1}
                borderRadius="lg"
                boxShadow="xl"
                bg="white"
                w={{ base: "90%", sm: "80%", md: "600px" }}
            >
                <MotionVStack spacing={5} align="stretch">
                    <MotionHeading
                        as="h1"
                        size="lg"
                        textAlign="center"
                        color="blue.600"
                        variants={itemVariants}
                    >
                        Welcome!
                    </MotionHeading>
                    <MotionText
                        textAlign="center"
                        fontSize="md"
                        variants={itemVariants}
                    >
                        Please set up your initial preferences to continue.
                    </MotionText>

                    <MotionBox variants={itemVariants}>
                        <FormControl isRequired>
                            <FormLabel>Your Name</FormLabel>
                            <Input
                                placeholder="Dr. Ada Lovelace"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </FormControl>
                    </MotionBox>
                    <MotionBox variants={itemVariants}>
                        <FormControl isRequired>
                            <FormLabel>Your Specialty</FormLabel>
                            <Select
                                placeholder="Select specialty"
                                value={specialty}
                                onChange={(e) => setSpecialty(e.target.value)}
                            >
                                {SPECIALTIES.map((spec) => (
                                    <option key={spec} value={spec}>
                                        {spec}
                                    </option>
                                ))}
                            </Select>
                        </FormControl>
                    </MotionBox>

                    <MotionHeading
                        as="h2"
                        size="md"
                        mt={3}
                        mb={1}
                        color="blue.500"
                        variants={itemVariants}
                    >
                        Language Model Setup
                    </MotionHeading>
                    <MotionBox variants={itemVariants}>
                        <FormControl>
                            <FormLabel>LLM Provider</FormLabel>
                            <Select
                                value={llmProvider}
                                onChange={(e) => setLlmProvider(e.target.value)}
                            >
                                <option value="ollama">Ollama</option>
                                <option value="openai">
                                    OpenAI-compatible
                                </option>
                            </Select>
                        </FormControl>
                    </MotionBox>
                    <MotionBox variants={itemVariants}>
                        <FormControl>
                            <FormLabel>LLM Base URL</FormLabel>
                            <Input
                                placeholder={
                                    llmProvider === "openai"
                                        ? "e.g., https://api.openai.com/v1"
                                        : "e.g., http://localhost:11434"
                                }
                                value={llmBaseUrl}
                                onChange={(e) => setLlmBaseUrl(e.target.value)}
                                onBlur={fetchLLMModelsCallback}
                            />
                        </FormControl>
                    </MotionBox>
                    <MotionBox variants={itemVariants}>
                        <FormControl isRequired={availableModels.length > 0}>
                            <FormLabel>Primary Model</FormLabel>
                            <Select
                                placeholder={
                                    availableModels.length === 0 &&
                                    !isFetchingLLMModels
                                        ? "No models found or URL needed"
                                        : "Select primary model"
                                }
                                value={primaryModel}
                                onChange={(e) =>
                                    setPrimaryModel(e.target.value)
                                }
                                isDisabled={
                                    isFetchingLLMModels ||
                                    availableModels.length === 0
                                }
                            >
                                {availableModels.map((model) => (
                                    <option key={model} value={model}>
                                        {model}
                                    </option>
                                ))}
                            </Select>
                            {isFetchingLLMModels && (
                                <Flex align="center" mt={1}>
                                    <Spinner size="xs" mr={2} />
                                    <Text fontSize="xs">
                                        Loading LLM models...
                                    </Text>
                                </Flex>
                            )}
                            {!isFetchingLLMModels &&
                                availableModels.length === 0 &&
                                llmBaseUrl.trim() && (
                                    <Text
                                        fontSize="xs"
                                        color="orange.600"
                                        mt={1}
                                    >
                                        No models found. Check URL or ensure the
                                        model server is running and configured.
                                    </Text>
                                )}
                        </FormControl>
                    </MotionBox>

                    <MotionHeading
                        as="h2"
                        size="md"
                        mt={3}
                        mb={1}
                        color="blue.500"
                        variants={itemVariants}
                    >
                        Transcription Setup
                    </MotionHeading>
                    <MotionBox variants={itemVariants}>
                        <FormControl>
                            <FormLabel>Whisper Base URL (Optional)</FormLabel>
                            <Input
                                placeholder="e.g., http://localhost:8080"
                                value={whisperBaseUrl}
                                onChange={(e) =>
                                    setWhisperBaseUrl(e.target.value)
                                }
                                onBlur={fetchWhisperModelsCallback}
                            />
                        </FormControl>
                    </MotionBox>
                    <MotionBox variants={itemVariants}>
                        <FormControl isRequired={whisperBaseUrl.trim() !== ""}>
                            <FormLabel>Whisper Model</FormLabel>
                            {whisperModelListAvailable &&
                            availableWhisperModels.length > 0 ? (
                                <Select
                                    placeholder="Select Whisper model"
                                    value={whisperModel}
                                    onChange={(e) =>
                                        setWhisperModel(e.target.value)
                                    }
                                    isDisabled={isFetchingWhisperModels}
                                >
                                    {availableWhisperModels.map((model) => (
                                        <option key={model} value={model}>
                                            {model}
                                        </option>
                                    ))}
                                </Select>
                            ) : (
                                <Input
                                    placeholder={
                                        whisperBaseUrl.trim() === ""
                                            ? "Enter Whisper URL to specify model"
                                            : "Enter model name (e.g., whisper-1)"
                                    }
                                    value={whisperModel}
                                    onChange={(e) =>
                                        setWhisperModel(e.target.value)
                                    }
                                    isDisabled={
                                        isFetchingWhisperModels ||
                                        whisperBaseUrl.trim() === ""
                                    }
                                />
                            )}
                            {isFetchingWhisperModels && (
                                <Flex align="center" mt={1}>
                                    <Spinner size="xs" mr={2} />
                                    <Text fontSize="xs">
                                        Loading Whisper models...
                                    </Text>
                                </Flex>
                            )}
                            {!isFetchingWhisperModels &&
                                whisperBaseUrl.trim() &&
                                whisperModelListAvailable &&
                                availableWhisperModels.length === 0 && (
                                    <Text
                                        fontSize="xs"
                                        color="orange.600"
                                        mt={1}
                                    >
                                        No Whisper models listed by API. Enter
                                        model name manually.
                                    </Text>
                                )}
                            {!isFetchingWhisperModels &&
                                whisperBaseUrl.trim() &&
                                !whisperModelListAvailable && (
                                    <Text fontSize="xs" color="blue.600" mt={1}>
                                        Model list not available from API. Enter
                                        model name manually if needed.
                                    </Text>
                                )}
                        </FormControl>
                    </MotionBox>

                    <MotionButton
                        colorScheme="green"
                        onClick={handleContinue}
                        isLoading={isLoading}
                        mt={6}
                        size="lg"
                        w="full"
                        variants={itemVariants}
                    >
                        Save and Continue
                    </MotionButton>
                </MotionVStack>
            </MotionBox>
        </Flex>
    );
};

export default SplashScreen;
