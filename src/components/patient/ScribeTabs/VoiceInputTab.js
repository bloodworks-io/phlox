import React from "react";
import {
    Box,
    Flex,
    VStack,
    HStack,
    Text,
    Textarea,
    Button,
    Spinner,
} from "@chakra-ui/react";
import { FaMicrophone, FaUpload, FaRedo } from "react-icons/fa";
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
}) => {
    const { isTranscribing } = useTranscription(onTranscriptionComplete);

    const handleClearTranscription = () => {
        onTranscriptionComplete({ rawTranscription: "" });
    };

    return (
        <Box className="tab-panel-container">
            <VStack spacing={4} width="full">
                {rawTranscription ? (
                    <Box
                        position="relative"
                        width="full"
                        display="flex"
                        justifyContent="center"
                        mb={4}
                        mt={2}
                    >
                        <Button
                            leftIcon={<FaRedo />}
                            onClick={handleClearTranscription}
                            colorScheme="blue"
                            size="md"
                        >
                            Start New Transcription
                        </Button>
                    </Box>
                ) : (
                    <Box
                        position="relative"
                        width="full"
                        display="flex"
                        justifyContent="center"
                        mb={4}
                        mt={2}
                    >
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
                            <Flex width="full" position="relative" zIndex={1}>
                                <Button
                                    className={`mode-selector-button ${mode === "record" ? "active" : ""}`}
                                    leftIcon={<FaMicrophone />}
                                    onClick={() => setMode("record")}
                                >
                                    Live Recording
                                </Button>
                                <Button
                                    className={`mode-selector-button ${mode === "upload" ? "active" : ""}`}
                                    leftIcon={<FaUpload />}
                                    onClick={() => setMode("upload")}
                                >
                                    Upload Audio
                                </Button>
                            </Flex>
                        </Flex>
                    </Box>
                )}

                {rawTranscription ? (
                    <Box
                        width="100%"
                        position="relative"
                        className="textarea-container"
                    >
                        <Textarea
                            value={rawTranscription}
                            readOnly
                            placeholder="Transcription will appear here..."
                            rows={6}
                            mb={4}
                            className="transcription-style"
                        />
                    </Box>
                ) : (
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
                            <RecordingWidget {...recordingProps} />
                        )}
                    </Box>
                )}

                {transcriptionDuration && (
                    <HStack fontSize="xs" color="gray.500">
                        <Text>Transcription: {transcriptionDuration}s</Text>
                        <Text>|</Text>
                        <Text>Processing: {processDuration}s</Text>
                    </HStack>
                )}
            </VStack>
        </Box>
    );
};

export default VoiceInputTab;
