import React, { useState, useRef, useEffect } from "react";
import {
    Box,
    Button,
    Flex,
    Input,
    Spinner,
    Text,
    VStack,
    HStack,
    useColorMode,
    useTheme,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    ButtonGroup,
} from "@chakra-ui/react";
import {
    FaMicrophone,
    FaPause,
    FaUpload,
    FaUndo,
    FaRedo,
    FaFileUpload,
    FaExclamationTriangle,
    FaRedoAlt,
} from "react-icons/fa";
import { useTranscription } from "../../../utils/hooks/useTranscription";

// WaveformVisualizer component
const WaveformVisualizer = React.memo(({ isRecording, isPaused }) => {
    const theme = useTheme();
    const { colorMode } = useColorMode();
    const barCount = window.innerWidth < 768 ? 8 : 16;

    const [bars] = useState(() =>
        [...Array(barCount)].map(() => ({
            frequency: 1 + Math.random(),
            delay: Math.random() * -2,
        })),
    );

    if (!isRecording && !isPaused) return null;

    return (
        <Flex h="40px" align="center" justify="center" mt={2}>
            {bars.map((bar, i) => (
                <Box
                    key={i}
                    w="3px"
                    mx="1.5px"
                    borderRadius="full"
                    bg={
                        theme.colors[colorMode === "light" ? "light" : "dark"]
                            .primaryButton
                    }
                    opacity={isPaused ? "0.5" : "1"}
                    animation={
                        isRecording && !isPaused
                            ? `barAnimation ${bar.frequency}s infinite ease-in-out`
                            : "none"
                    }
                    sx={{
                        "@keyframes barAnimation": {
                            "0%, 100%": { height: "8px" },
                            "50%": { height: "24px" },
                        },
                    }}
                    style={{
                        animationDelay: `${bar.delay}s`,
                        height: isPaused ? "8px" : undefined,
                        transition: "all 0.3s ease-out",
                        // Preserve the current animation state when pausing
                        animationPlayState: isPaused ? "paused" : "running",
                    }}
                />
            ))}
        </Flex>
    );
});

const RecordingWidget = ({
    mode,
    toggleMode,
    onTranscriptionComplete,
    name,
    dob,
    gender,
    templateKey,
}) => {
    const { colorMode } = useColorMode();
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [transcriptionError, setTranscriptionError] = useState(null);
    const [uploadedFile, setUploadedFile] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const completeRecordingRef = useRef([]);
    const timerIntervalRef = useRef(null);

    const { transcribeAudio, isTranscribing: isApiTranscribing } =
        useTranscription((data) => {
            if (data.error) {
                setTranscriptionError({
                    message:
                        data.error || "An error occurred during transcription.",
                });
                setLoading(false);
            } else {
                // Clear any error state when transcription succeeds
                setTranscriptionError(null);
                // Call the original callback
                onTranscriptionComplete(data);
            }
        });

    useEffect(() => {
        // Reset state when component mounts or remounts
        setIsRecording(false);
        setIsPaused(false);
        setLoading(false);
        setTimer(0);
        setAudioBlob(null);
        setTranscriptionError(null);
        audioChunksRef.current = [];
        completeRecordingRef.current = [];
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stream
                .getTracks()
                .forEach((track) => track.stop());
        }
        mediaRecorderRef.current = null;

        // Cleanup function
        return () => {
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stream
                    .getTracks()
                    .forEach((track) => track.stop());
            }
            clearInterval(timerIntervalRef.current);
            resetRecordingState();
        };
    }, [name, dob, gender]);

    useEffect(() => {
        // Reset completeRecordingRef when a new patient is selected
        completeRecordingRef.current = [];
    }, [name, dob, gender]);

    useEffect(() => {
        if (isRecording && !isPaused) {
            timerIntervalRef.current = setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerIntervalRef.current);
        }
        return () => clearInterval(timerIntervalRef.current);
    }, [isRecording, isPaused]);

    const resetRecordingState = () => {
        setIsRecording(false);
        setIsPaused(false);
        setTimer(0);
        setAudioBlob(null);
        setTranscriptionError(null);
        audioChunksRef.current = [];
        completeRecordingRef.current = [];
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stream
                .getTracks()
                .forEach((track) => track.stop());
        }
        mediaRecorderRef.current = null;
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("getUserMedia is not supported in this browser.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                completeRecordingRef.current = [
                    ...completeRecordingRef.current,
                    ...audioChunksRef.current,
                ];
                const audioBlob = new Blob(completeRecordingRef.current, {
                    type: "audio/wav",
                });
                setAudioBlob(audioBlob); // Store the audio file in state
                audioChunksRef.current = [];
                setIsRecording(false);
                setIsPaused(false);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setTimer(0);
            // Clear any previous error when starting a new recording
            setTranscriptionError(null);
        } catch (error) {
            console.error("Error starting recording:", error);
            setTranscriptionError({
                message:
                    "Could not access microphone. Please check your permissions and try again.",
            });
        }
    };

    const stopRecording = () => {
        return new Promise((resolve) => {
            console.log("stopRecording called");
            if (isRecording) {
                mediaRecorderRef.current.onstop = () => {
                    console.log("MediaRecorder stopped");
                    completeRecordingRef.current = [
                        ...completeRecordingRef.current,
                        ...audioChunksRef.current,
                    ];
                    const newAudioBlob = new Blob(
                        completeRecordingRef.current,
                        {
                            type: "audio/wav",
                        },
                    );
                    console.log(
                        "New audio blob created, size:",
                        newAudioBlob.size,
                    );
                    audioChunksRef.current = [];
                    setIsRecording(false);
                    setIsPaused(false);
                    resolve(newAudioBlob);
                };
                mediaRecorderRef.current.stop();
            } else {
                resolve(null);
            }
        });
    };

    const pauseRecording = () => {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
    };

    const resumeRecording = () => {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
    };

    const sendRecording = async () => {
        console.log("sendRecording called");
        let currentAudioBlob;
        if (isRecording) {
            console.log("Stopping recording");
            currentAudioBlob = await stopRecording();
        } else {
            currentAudioBlob = audioBlob;
        }

        console.log(
            "Audio blob size:",
            currentAudioBlob ? currentAudioBlob.size : "No audio blob",
            "Audio blob type:",
            currentAudioBlob ? currentAudioBlob.type : "N/A",
        );

        if (!currentAudioBlob || !(currentAudioBlob instanceof Blob)) {
            console.error("No valid recording data available.");
            setTranscriptionError({
                message:
                    "No valid recording data available. Please record again.",
            });
            return;
        }

        setLoading(true);
        setAudioBlob(currentAudioBlob); // Make sure we save this for potential retry
        setTranscriptionError(null);

        try {
            await transcribeAudio(currentAudioBlob, {
                name,
                gender,
                dob,
                templateKey,
            });
        } catch (error) {
            console.error("Error in sendRecording:", error);
            setTranscriptionError({
                message:
                    "Failed to transcribe your recording. Server might be experiencing issues.",
            });
            setLoading(false);
        }
    };

    const retryTranscription = async () => {
        // Determine which audio to resend - either from a recording or an uploaded file
        const audioToSend = mode === "upload" ? uploadedFile : audioBlob;

        if (!audioToSend) {
            setTranscriptionError({
                message:
                    "No audio data available to retry. Please record or upload again.",
            });
            return;
        }

        setLoading(true);
        setTranscriptionError(null);

        try {
            await transcribeAudio(audioToSend, {
                name,
                gender,
                dob,
                templateKey,
            });
        } catch (error) {
            console.error("Error retrying transcription:", error);
            setTranscriptionError({
                message:
                    "Transcription retry failed. The server might be experiencing issues.",
            });
            setLoading(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Clear any previous error state
        setTranscriptionError(null);
        // Save the file for potential retries
        setUploadedFile(file);

        setLoading(true);
        try {
            await transcribeAudio(file, {
                name,
                gender,
                dob,
                templateKey,
            });
        } catch (error) {
            console.error("Error uploading file:", error);
            setTranscriptionError({
                message:
                    "Failed to process your audio file. Server might be experiencing issues.",
            });
            setLoading(false);
        }
    };

    const resetRecording = () => {
        if (
            window.confirm(
                "Are you sure you want to reset the recording? This will discard the current recording.",
            )
        ) {
            stopRecording();
            completeRecordingRef.current = [];
            setAudioBlob(null); // Clear the stored audio blob
            setTimer(0);
            setTranscriptionError(null);
        }
    };

    const startNewRecording = () => {
        resetRecordingState();
        setUploadedFile(null);
        setTranscriptionError(null);
    };

    // If there's a transcription error, show the error UI
    if (transcriptionError) {
        return (
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
                            onClick={retryTranscription}
                            className="green-button"
                            isDisabled={loading}
                        >
                            {loading ? <Spinner size="sm" mr={2} /> : null}
                            {mode === "upload" ? "Resend File" : "Resend Audio"}
                        </Button>
                        <Button
                            leftIcon={<FaRedo />}
                            onClick={startNewRecording}
                            className="blue-button"
                        >
                            {mode === "upload"
                                ? "Upload New File"
                                : "Start New Recording"}
                        </Button>
                    </ButtonGroup>
                </Alert>
            </Box>
        );
    }

    return (
        <Box>
            {loading ? (
                <Flex justify="center" align="center" height="100px">
                    <Spinner size="xl" />
                </Flex>
            ) : (
                <VStack spacing={4} align="stretch">
                    {mode === "record" ? (
                        <>
                            <HStack>
                                <Button
                                    onClick={
                                        isRecording
                                            ? isPaused
                                                ? resumeRecording
                                                : pauseRecording
                                            : startRecording
                                    }
                                    colorScheme={
                                        isRecording
                                            ? isPaused
                                                ? "yellow"
                                                : "red"
                                            : "blue"
                                    }
                                    leftIcon={
                                        isRecording ? (
                                            isPaused ? (
                                                <FaMicrophone />
                                            ) : (
                                                <FaPause />
                                            )
                                        ) : (
                                            <FaMicrophone />
                                        )
                                    }
                                    className="blue-button"
                                >
                                    {isRecording
                                        ? isPaused
                                            ? "Resume"
                                            : "Pause"
                                        : "Start Recording"}
                                </Button>
                                {isRecording && (
                                    <>
                                        <Button
                                            onClick={sendRecording}
                                            colorScheme="green"
                                            leftIcon={<FaUpload />}
                                            className="green-button"
                                        >
                                            Send
                                        </Button>
                                        <Button
                                            onClick={resetRecording}
                                            colorScheme="red"
                                            leftIcon={<FaUndo />}
                                            className="red-button"
                                        >
                                            Reset
                                        </Button>
                                    </>
                                )}
                                {!isRecording && audioBlob && (
                                    <Button
                                        onClick={sendRecording}
                                        colorScheme="blue"
                                        leftIcon={<FaRedo />}
                                        className="blue-button"
                                    >
                                        Send Recording
                                    </Button>
                                )}
                            </HStack>

                            {/* Add the waveform visualizer */}
                            {isRecording && (
                                <WaveformVisualizer
                                    isRecording={isRecording}
                                    isPaused={isPaused}
                                    colorMode={colorMode}
                                />
                            )}

                            {isRecording && (
                                <Text>{`Recording Time: ${Math.floor(timer / 60)}:${String(
                                    timer % 60,
                                ).padStart(2, "0")}`}</Text>
                            )}
                        </>
                    ) : (
                        <HStack>
                            <Input
                                type="file"
                                onChange={handleFileUpload}
                                accept="audio/*"
                                className="input-style"
                                style={{ display: "none" }}
                                id="audio-file-input"
                            />
                            <Button
                                px="10"
                                leftIcon={<FaFileUpload />}
                                onClick={() =>
                                    document
                                        .getElementById("audio-file-input")
                                        .click()
                                }
                                className="blue-button"
                            >
                                Upload Audio File
                            </Button>
                            {uploadedFile && (
                                <Text ml={2} fontSize="sm">
                                    {uploadedFile.name}
                                </Text>
                            )}
                        </HStack>
                    )}
                </VStack>
            )}
        </Box>
    );
};

export default RecordingWidget;
