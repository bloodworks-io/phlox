import React, { useContext, useState, useRef, useEffect } from "react";
import {
    Box,
    Flex,
    VStack,
    HStack,
    Text,
    Button,
    Spinner,
    ButtonGroup,
    IconButton,
    Tooltip,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
} from "@chakra-ui/react";
import {
    FaMicrophone,
    FaUpload,
    FaRedo,
    FaSync,
    FaArrowLeft,
    FaFileAudio,
    FaExclamationTriangle,
    FaRedoAlt,
    FaClock,
    FaCogs,
} from "react-icons/fa";
import RecordingWidget from "./RecordingWidget";
import { useTranscription } from "../../../utils/hooks/useTranscription";

const VoiceInputTab = ({
    mode,
    setMode,
    recordingProps,
    transcriptionDuration,
    processDuration,
    rawTranscription,
    onTranscriptionComplete,
    setLoading,
}) => {
    const { isTranscribing, reprocessTranscription, transcribeAudio } =
        useTranscription(onTranscriptionComplete, setLoading);

    // Store the original transcription to allow for returning to it
    const [savedTranscription, setSavedTranscription] = useState(null);
    const [viewMode, setViewMode] = useState(
        rawTranscription ? "transcription" : "recording",
    );
    const [transcriptionError, setTranscriptionError] = useState(null);
    const [lastAudioBlob, setLastAudioBlob] = useState(null);

    // Reset all states when patient changes
    useEffect(() => {
        // Detect patient change by watching patient-specific props
        setViewMode(rawTranscription ? "transcription" : "recording");
        setSavedTranscription(null);
        setTranscriptionError(null);
        setLastAudioBlob(null);
    }, [recordingProps.name, recordingProps.dob, recordingProps.gender]);

    // Reset error state when rawTranscription changes
    useEffect(() => {
        if (rawTranscription) {
            setTranscriptionError(null);
            setViewMode("transcription");
        }
    }, [rawTranscription]);

    const handleClearTranscription = () => {
        // Save current transcription before clearing
        setSavedTranscription(rawTranscription);
        setViewMode("recording");
        setTranscriptionError(null);

        // Pass empty content but don't collapse the transcription section
        onTranscriptionComplete(
            {
                rawTranscription: "",
                fields: {},
                transcriptionDuration: 0,
                processDuration: 0,
            },
            false,
        );
    };

    const handleCancelNewTranscription = () => {
        // Restore the previous transcription
        if (savedTranscription) {
            setViewMode("transcription");

            // Use a special flag to indicate this is a restoration operation
            // This will help PatientDetails.js know not to collapse the section
            onTranscriptionComplete({
                rawTranscription: savedTranscription,
                fields: {}, // We don't need to reprocess fields for restoration
                transcriptionDuration: transcriptionDuration || 0,
                processDuration: processDuration || 0,
                isRestoration: true, // Add this flag
            });
        }
    };

    const handleReprocessTranscription = async () => {
        if (!rawTranscription) return;

        try {
            await reprocessTranscription(
                rawTranscription,
                {
                    name: recordingProps.name,
                    gender: recordingProps.gender,
                    dob: recordingProps.dob,
                    templateKey: recordingProps.templateKey,
                },
                transcriptionDuration,
            );
        } catch (error) {
            console.error("Failed to reprocess transcription:", error);
        }
    };

    // Function to handle retrying a failed transcription
    const handleRetryTranscription = async () => {
        if (!lastAudioBlob || !(lastAudioBlob instanceof Blob)) {
            setTranscriptionError({
                message: "No valid audio data to retry. Please record again.",
                type: "missing_data",
            });
            return;
        }

        setTranscriptionError(null);
        try {
            await transcribeAudio(lastAudioBlob, {
                name: recordingProps.name,
                gender: recordingProps.gender,
                dob: recordingProps.dob,
                templateKey: recordingProps.templateKey,
            });
        } catch (error) {
            console.error("Failed to retry transcription:", error);
            setTranscriptionError({
                message:
                    "Transcription failed again. Please try recording a new audio or check your Whisper endpoint configuration.",
                type: "retry",
            });
        }
    };

    // Intercept the RecordingWidget's onTranscriptionComplete to capture errors
    const handleRecordingComplete = async (audioBlob) => {
        // Only store valid Blob objects for potential retries
        if (audioBlob instanceof Blob) {
            setLastAudioBlob(audioBlob);
        } else {
            console.error(
                "Invalid audio data received, not a Blob:",
                typeof audioBlob,
            );
            setTranscriptionError({
                message: "Invalid audio data format. Please try again.",
                type: "format",
            });
            return;
        }

        try {
            // Check if audioBlob is usable
            if (audioBlob.size === 0) {
                throw new Error("Empty audio data");
            }

            await transcribeAudio(audioBlob, {
                name: recordingProps.name,
                gender: recordingProps.gender,
                dob: recordingProps.dob,
                templateKey: recordingProps.templateKey,
            });
            setTranscriptionError(null);
        } catch (error) {
            console.error("Transcription failed:", error);
            setTranscriptionError({
                message:
                    "We couldn't transcribe your audio. The server might be experiencing issues.",
                type: "initial",
            });
        }
    };

    const isShowingTranscription =
        rawTranscription && viewMode === "transcription" && !transcriptionError;
    const hasTranscriptionToRestoreTo =
        savedTranscription && viewMode === "recording";

    const enhancedRecordingProps = {
        ...recordingProps,
    };

    return (
        <Box className="tab-panel-container">
            <VStack spacing={4} width="full">
                {isShowingTranscription ? (
                    <Box
                        position="relative"
                        width="full"
                        display="flex"
                        flexDirection="column"
                        mb={4}
                        mt={2}
                    >
                        <Flex
                            justifyContent="center"
                            alignItems="center"
                            width="full"
                            mb={3}
                        >
                            <ButtonGroup spacing={3}>
                                <Button
                                    leftIcon={<FaRedo />}
                                    onClick={handleClearTranscription}
                                    className="blue-button"
                                >
                                    Start New Transcription
                                </Button>
                                <Button
                                    leftIcon={
                                        isTranscribing ? (
                                            <Spinner size="sm" mr={2} />
                                        ) : (
                                            <FaSync />
                                        )
                                    }
                                    onClick={handleReprocessTranscription}
                                    className="tertiary-button"
                                    isDisabled={isTranscribing}
                                >
                                    {isTranscribing
                                        ? "Reprocessing..."
                                        : "Reprocess Transcription"}
                                </Button>
                            </ButtonGroup>
                        </Flex>

                        <Box
                            width="100%"
                            position="relative"
                            className="transcription-container"
                        >
                            <Text as="h7" fontSize="sm">
                                Transcription:
                            </Text>
                            <Box
                                p={3}
                                mt={2}
                                borderRadius="md"
                                borderWidth="1px"
                                bg="gray.50"
                                _dark={{ bg: "gray.700" }}
                                maxHeight="100px"
                                overflowY="auto"
                                className="transcription-view"
                                css={{
                                    "&::-webkit-scrollbar": {
                                        width: "8px",
                                    },
                                    "&::-webkit-scrollbar-track": {
                                        width: "10px",
                                        background: "transparent",
                                    },
                                    "&::-webkit-scrollbar-thumb": {
                                        background: "#CBD5E0",
                                        borderRadius: "24px",
                                    },
                                }}
                            >
                                <Text whiteSpace="pre-wrap" fontSize="sm">
                                    {rawTranscription}
                                </Text>
                            </Box>
                        </Box>

                        {transcriptionDuration && (
                            <HStack
                                fontSize="xs"
                                color="gray.500"
                                mt={1}
                                spacing={3}
                                justify="flex-end"
                            >
                                <Tooltip label="Time taken to transcribe the audio">
                                    <HStack>
                                        <Box as={FaClock} size="12px" />
                                        <Text>{transcriptionDuration}s</Text>
                                    </HStack>
                                </Tooltip>
                                <Tooltip label="Time taken to process and analyze the transcription">
                                    <HStack>
                                        <Box as={FaCogs} size="12px" />
                                        <Text>{processDuration}s</Text>
                                    </HStack>
                                </Tooltip>
                            </HStack>
                        )}
                    </Box>
                ) : transcriptionError ? (
                    // Show error and retry UI
                    <Box width="100%">
                        <Alert
                            status="error"
                            variant="subtle"
                            flexDirection="column"
                            alignItems="center"
                            justifyContent="center"
                            textAlign="center"
                            borderRadius="sm"
                        >
                            <Flex mb={2}>
                                <AlertIcon as={FaExclamationTriangle} mr={2} />
                                <AlertTitle>Transcription Error</AlertTitle>
                            </Flex>
                            <AlertDescription maxWidth="lg">
                                {transcriptionError.message}
                            </AlertDescription>
                            <ButtonGroup mt={4} spacing={3}>
                                <Button
                                    leftIcon={<FaRedoAlt />}
                                    onClick={handleRetryTranscription}
                                    className="green-button"
                                    isDisabled={isTranscribing}
                                >
                                    Resend Audio
                                </Button>
                                <Button
                                    leftIcon={<FaRedo />}
                                    onClick={handleClearTranscription}
                                    className="blue-button"
                                >
                                    Start New Recording
                                </Button>
                                {hasTranscriptionToRestoreTo && (
                                    <Button
                                        leftIcon={<FaArrowLeft />}
                                        onClick={handleCancelNewTranscription}
                                        variant="ghost"
                                        size="sm"
                                        className="switch-mode"
                                    >
                                        Return to Previous
                                    </Button>
                                )}
                            </ButtonGroup>
                        </Alert>
                    </Box>
                ) : (
                    <>
                        <Box
                            position="relative"
                            width="full"
                            display="flex"
                            justifyContent="center"
                            mb={4}
                            mt={2}
                        >
                            {hasTranscriptionToRestoreTo && (
                                <Button
                                    leftIcon={<FaArrowLeft />}
                                    onClick={handleCancelNewTranscription}
                                    variant="ghost"
                                    size="sm"
                                    position="absolute"
                                    left="0"
                                    top="0"
                                    className="switch-mode"
                                >
                                    Return
                                </Button>
                            )}

                            <Flex
                                className="mode-selector"
                                alignItems="center"
                                p={1}
                            >
                                <Box
                                    className="mode-selector-indicator"
                                    left={
                                        mode === "record"
                                            ? "2px"
                                            : "calc(50% - 2px)"
                                    }
                                />
                                <Flex
                                    width="full"
                                    position="relative"
                                    zIndex={1}
                                >
                                    <Button
                                        className={`mode-selector-button ${mode === "record" ? "active" : ""} blue-button`}
                                        leftIcon={<FaMicrophone />}
                                        onClick={() => setMode("record")}
                                    >
                                        Live Recording
                                    </Button>
                                    <Button
                                        className={`mode-selector-button ${mode === "upload" ? "active" : ""} tertiary-button`}
                                        leftIcon={<FaFileAudio />}
                                        onClick={() => setMode("upload")}
                                    >
                                        Upload Audio
                                    </Button>
                                </Flex>
                            </Flex>
                        </Box>

                        <Box style={{ minHeight: "50px" }}>
                            {isTranscribing ? (
                                <Flex
                                    justify="center"
                                    align="center"
                                    height="100px"
                                >
                                    <Spinner size="xl" />
                                </Flex>
                            ) : (
                                <RecordingWidget {...enhancedRecordingProps} />
                            )}
                        </Box>
                    </>
                )}
            </VStack>
        </Box>
    );
};

export default VoiceInputTab;
