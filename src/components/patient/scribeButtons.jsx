import React from "react";
import { useColorMode } from "../ui/color-mode";
import { Box, Flex, Text } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import {
    FaMicrophone,
    FaPause,
    FaPlay,
    FaTimes,
    FaComments,
    FaKeyboard,
    FaPaperPlane,
    FaFileAlt,
    FaCircle,
    FaRedoAlt,
    FaDownload,
    FaExclamationTriangle,
} from "react-icons/fa";
import PillBox from "../common/PillBox";
import { colors } from "../../theme/colors";
import { LavaBlobs, InternalGlow } from "./scribeVisuals";

// Main record button with states
export const RecordButton = ({
    isRecording,
    isPaused,
    onStart,
    onPause,
    onResume,
    size = 56,
    canStart = true,
    onBlockedClick,
}) => {
    const { colorMode } = useColorMode();
    const [isHovered, setIsHovered] = React.useState(false);

    const getButtonStyles = () => {
        if (isRecording && !isPaused) {
            return {
                bg: "#E53E3E",
                color: "white",
                boxShadow: "0 0 0 0 rgba(229, 62, 62, 0.4)",
            };
        } else if (isPaused) {
            return {
                bg: "#DD6B20",
                color: "white",
                boxShadow: "none",
            };
        } else {
            return {
                bg: "transparent",
                color: "white",
                boxShadow: "none",
            };
        }
    };

    const styles = getButtonStyles();

    // Determine what icon to show
    const getIcon = () => {
        if (isRecording && !isPaused) {
            // When recording, show pause on hover, otherwise show circle
            return isHovered ? <FaPause size={20} /> : <FaCircle size={20} />;
        } else if (isPaused) {
            return <FaPlay size={20} />;
        } else {
            return <FaMicrophone size={20} />;
        }
    };

    const getLabel = () => {
        if (isRecording && !isPaused) {
            return isHovered ? "Pause" : "Recording...";
        } else if (isPaused) {
            return "Resume";
        } else if (!canStart) {
            return "Enter patient details (name, DOB, UR number) to start recording";
        } else {
            return "Record";
        }
    };

    const handleClick = () => {
        if (isRecording) {
            if (isPaused) {
                onResume();
            } else {
                onPause();
            }
        } else if (!canStart) {
            onBlockedClick?.();
        } else {
            onStart();
        }
    };

    return (
        <Tooltip content={getLabel()} showArrow positioning={{
            placement: "top"
        }}>
            <Box
                position="relative"
                display="flex"
                alignItems="center"
                justifyContent="center"
                w={`${size}px`}
                h={`${size}px`}
                borderRadius="full"
                border="none"
                cursor="pointer"
                transition="all 0.2s ease"
                outline="none"
                overflow="hidden"
                boxShadow="xl"
                {...styles}
                asChild><button
                    onClick={handleClick}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}>
                    {/* Idle state: lava blobs (muted when recording is locked) */}
                    {!isRecording && !isPaused && (
                        <Box
                            opacity={canStart ? 1 : 0.4}
                            filter={canStart ? "none" : "grayscale(1)"}
                        >
                            <LavaBlobs />
                        </Box>
                    )}
                    {/* Recording state: internal pulsing glow */}
                    {isRecording && !isPaused && <InternalGlow />}
                    {/* Inner highlight border */}
                    <Box
                        position="absolute"
                        top="2px"
                        left="2px"
                        right="2px"
                        bottom="2px"
                        borderRadius="full"
                        border="1px solid rgba(255,255,255,0.3)"
                        pointerEvents="none"
                    />
                    {/* Icon */}
                    <Box position="relative" zIndex={1}>
                        {getIcon()}
                    </Box>
                </button></Box>
        </Tooltip>
    );
};

// Left button: Mode toggle (idle) / Reset (recording)
export const ModeResetButton = ({
    isRecording,
    isAmbient,
    onModeToggle,
    onReset,
}) => {
    const { colorMode } = useColorMode();
    const [isHovered, setIsHovered] = React.useState(false);

    if (isRecording) {
        // Reset button state
        return (
            <Tooltip content="Reset" showArrow positioning={{
                placement: "top"
            }}>
                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="40px"
                    h="40px"
                    borderRadius="full"
                    border="1px solid #ECC94B"
                    cursor="pointer"
                    transition="all 0.2s ease"
                    outline="none"
                    bg={isHovered ? "#ECC94B" : "transparent"}
                    color={isHovered ? "white" : "#ECC94B"}
                    boxShadow="md"
                    _hover={{
                        transform: "scale(1.05)",
                    }}
                    asChild><button
                        onClick={onReset}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}>
                        <FaTimes size={16} />
                    </button></Box>
            </Tooltip>
        );
    }

    // Mode toggle state
    const Icon = isAmbient ? FaComments : FaKeyboard;
    const label = isAmbient
        ? "Ambient mode - click for Dictate"
        : "Dictate mode - click for Ambient";

    return (
        <Tooltip content={label} showArrow positioning={{
            placement: "top"
        }}>
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="30px"
                h="30px"
                borderRadius="full"
                border="none"
                bg="transparent"
                cursor="pointer"
                transition="all 0.2s ease"
                outline="none"
                className="pill-box-icons"
                mr={0}
                boxShadow="none"
                _hover={{
                    bg: colors.dark.surface,
                    transform: "scale(1.05)",
                }}
                asChild><button onClick={onModeToggle}>
                    <Icon size={16} />
                </button></Box>
        </Tooltip>
    );
};

// Right button: Transcript (idle) / Send (recording)
export const TranscriptSendButton = ({
    isRecording,
    onOpenTranscription,
    onSend,
    isTranscriptionOpen,
    hasRawTranscription,
}) => {
    const { colorMode } = useColorMode();
    const [isHovered, setIsHovered] = React.useState(false);

    if (isRecording) {
        // Send button state
        return (
            <Tooltip content="Stop and send" showArrow positioning={{
                placement: "top"
            }}>
                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="40px"
                    h="40px"
                    borderRadius="full"
                    border="1px solid #48BB78"
                    cursor="pointer"
                    transition="all 0.2s ease"
                    outline="none"
                    bg={isHovered ? "#48BB78" : "transparent"}
                    color={isHovered ? "white" : "#48BB78"}
                    boxShadow="md"
                    _hover={{
                        transform: "scale(1.05)",
                    }}
                    asChild><button
                        onClick={onSend}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}>
                        <FaPaperPlane size={14} />
                    </button></Box>
            </Tooltip>
        );
    }

    // Transcript button state
    const isDisabled = !hasRawTranscription;
    const label = isDisabled ? "No transcript available" : "Transcript";

    return (
        <Tooltip content={label} showArrow positioning={{
            placement: "top"
        }}>
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="30px"
                h="30px"
                borderRadius="full"
                className="pill-box-icons"
                mr={0}
                cursor={isDisabled ? "not-allowed" : "pointer"}
                transition="all 0.2s ease"
                outline="none"
                opacity={isDisabled ? 0.4 : 1}
                bg={isTranscriptionOpen ? colors.dark.surface : "transparent"}
                _hover={
                    isDisabled
                        ? {}
                        : { bg: colors.dark.surface, transform: "scale(1.05)" }
                }
                pointerEvents={isDisabled ? "none" : "auto"}
                asChild><button onClick={onOpenTranscription}>
                    <FaFileAlt size={14} />
                </button></Box>
        </Tooltip>
    );
};

export const TranscriptionFailurePill = ({
    sendError,
    onRetry,
    onDownload,
    onDismiss,
}) => (
    <PillBox
        bottom="20px"
        left="50%"
        transform="translateX(-50%)"
        className="pill-box-scribe"
        px={3}
        py={2}
        gap={2}
    >
        <Tooltip
            content={sendError?.message || "Transcription failed"}
            showArrow
            positioning={{
                placement: "top"
            }}
        >
            <Flex align="center" gap={2} color="#E53E3E" pr={1}>
                <FaExclamationTriangle size={15} />
                <Text fontSize="xs" fontWeight="700">
                    Transcription failed
                </Text>
            </Flex>
        </Tooltip>
        <Tooltip content="Retry sending" showArrow positioning={{
            placement: "top"
        }}>
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="32px"
                h="32px"
                borderRadius="full"
                border="1px solid #48BB78"
                cursor="pointer"
                outline="none"
                color="#48BB78"
                bg="transparent"
                transition="all 0.2s ease"
                _hover={{
                    bg: "#48BB78",
                    color: "white",
                    transform: "scale(1.05)",
                }}
                asChild><button onClick={onRetry}>
                    <FaRedoAlt size={13} />
                </button></Box>
        </Tooltip>
        <Tooltip content="Download audio to retry later" showArrow positioning={{
            placement: "top"
        }}>
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="32px"
                h="32px"
                borderRadius="full"
                border="1px solid #4299E1"
                cursor="pointer"
                outline="none"
                color="#4299E1"
                bg="transparent"
                transition="all 0.2s ease"
                _hover={{
                    bg: "#4299E1",
                    color: "white",
                    transform: "scale(1.05)",
                }}
                asChild><button onClick={onDownload}>
                    <FaDownload size={13} />
                </button></Box>
        </Tooltip>
        <Tooltip
            content="Dismiss — download first to keep the audio"
            showArrow
            positioning={{
                placement: "top"
            }}
        >
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="32px"
                h="32px"
                borderRadius="full"
                border="none"
                cursor="pointer"
                outline="none"
                color="#A0AEC0"
                bg="transparent"
                className="pill-box-icons"
                transition="all 0.2s ease"
                _hover={{ color: "#E53E3E", transform: "scale(1.05)" }}
                asChild><button onClick={onDismiss}>
                    <FaTimes size={13} />
                </button></Box>
        </Tooltip>
    </PillBox>
);
