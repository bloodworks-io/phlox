import React from "react";
import { Box, Flex, Text, Popover } from "@chakra-ui/react";
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
    FaBolt,
    FaStop,
    FaCheck,
    FaExternalLinkAlt,
    FaWaveSquare,
} from "react-icons/fa";
import PillBox from "../common/PillBox";
import { colors } from "../../theme/colors";
import { LavaBlobs, InternalGlow, LoadingOrb } from "./scribeVisuals";

const PILL = {
    danger: colors.dark.dangerButton, // #ed8796
    success: colors.dark.successButton, // #a6da95
    warning: colors.dark.secondaryButton, // #eed49f
    info: colors.dark.primaryButton, // #8bd5ca
    muted: colors.dark.textSecondary, // #a5adcb
    dangerFill: colors.light.dangerButton, // #d20f39
    successFill: colors.light.successButton, // #40a02b
    warningFill: colors.light.secondaryButton, // #df8e1d
    infoFill: colors.light.primaryButton, // #179299
    onFill: "#ffffff",
};

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
    const [isHovered, setIsHovered] = React.useState(false);

    const getButtonStyles = () => {
        if (isRecording && !isPaused) {
            return {
                bg: PILL.dangerFill,
                color: PILL.onFill,
                boxShadow: "0 0 0 0 rgba(210, 15, 57, 0.4)",
            };
        } else if (isPaused) {
            return {
                bg: PILL.warningFill,
                color: PILL.onFill,
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
                p={0}
                flexShrink={0}
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
                    <Box
                        position="absolute"
                        top="50%"
                        left="50%"
                        transform="translate(-50%, -50%)"
                        zIndex={1}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                    >
                        {getIcon()}
                    </Box>
                </button></Box>
        </Tooltip>
    );
};

// Capture modes shown on the pill's mode dial.
const MODES = [
    {
        id: "dictate",
        icon: FaKeyboard,
        label: "Dictate",
        hint: "direct speech, processed on send",
    },
    {
        id: "ambient",
        icon: FaComments,
        label: "Ambient",
        hint: "captures the whole consultation",
    },
    {
        id: "agent",
        icon: FaBolt,
        label: "Live agent",
        hint: "streams and drafts the note as you talk",
    },
];

// Controlled open — mutually exclusive with the transcript panel.
export const ModeSelectButton = ({
    mode,
    isBusy = false,
    onSelect,
    open = false,
    onOpenChange,
}) => {
    const active = MODES.find((m) => m.id === mode) ?? MODES[0];
    const ActiveIcon = active.icon;

    const handleSelect = (id) => {
        onOpenChange?.(false);
        if (id !== mode) onSelect?.(id);
    };

    return (
        <Popover.Root
            open={open}
            onOpenChange={(d) => onOpenChange?.(d.open)}
            positioning={{ placement: "top" }}
            lazyRender
            closeOnBlur
        >
            <Popover.Trigger asChild>
                <Box
                    as="button"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="30px"
                    h="30px"
                    flexShrink={0}
                    borderRadius="full"
                    border="none"
                    bg="transparent"
                    p={0}
                cursor={isBusy ? "default" : "pointer"}
                color="white"
                opacity={isBusy ? 0.5 : 1}
                pointerEvents={isBusy ? "none" : "auto"}
                outline="none"
                transition="transform 0.2s ease"
                _hover={{ transform: "scale(1.1)" }}
                aria-label={`Capture mode: ${active.label}. Activate to change mode.`}
                >
                    <ActiveIcon size={15} />
                </Box>
            </Popover.Trigger>
            <Popover.Positioner>
                <Popover.Content w="250px" p={1.5}>
                    <Popover.Arrow>
                        <Popover.ArrowTip />
                    </Popover.Arrow>
                    {MODES.map((entry) => {
                        const Icon = entry.icon;
                        const isActive = entry.id === mode;
                        return (
                            <Box
                                key={entry.id}
                                as="button"
                                display="flex"
                                alignItems="center"
                                gap={2.5}
                                w="full"
                                px={2.5}
                                py={2}
                                borderRadius="8px"
                                border="none"
                                bg={isActive ? "surfaceQuartile" : "transparent"}
                                cursor={isActive ? "default" : "pointer"}
                                textAlign="left"
                                outline="none"
                                transition="background-color 0.15s ease"
                                _hover={
                                    isActive
                                        ? undefined
                                        : { bg: "surfaceQuartile" }
                                }
                                onClick={() => handleSelect(entry.id)}
                            >
                                <Box
                                    as="span"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    w="26px"
                                    h="26px"
                                    flexShrink={0}
                                    borderRadius="full"
                                    color={isActive ? "accent" : "textTertiary"}
                                    bg="surfaceQuartile"
                                >
                                    <Icon size={12} />
                                </Box>
                                <Box as="span" flex="1">
                                    <Text
                                        fontSize="xs"
                                        fontWeight="700"
                                        color={
                                            isActive
                                                ? "textPrimary"
                                                : "textSecondary"
                                        }
                                    >
                                        {entry.label}
                                    </Text>
                                    <Text
                                        fontSize="10px"
                                        color="textTertiary"
                                        lineHeight="1.3"
                                    >
                                        {entry.hint}
                                    </Text>
                                </Box>
                                {isActive && (
                                    <Box
                                        as="span"
                                        display="flex"
                                        alignItems="center"
                                        flexShrink={0}
                                        color="accent"
                                    >
                                        <FaCheck size={10} />
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                </Popover.Content>
            </Popover.Positioner>
        </Popover.Root>
    );
};


export const LiveAgentControls = ({ status = "live", onStop }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const isBusy = status === "connecting" || status === "stopping";
    const label =
        status === "connecting"
            ? "Warming up the agent…"
            : status === "stopping"
              ? "Wrapping up…"
              : "End live session";

    return (
        <Tooltip content={label} showArrow positioning={{ placement: "top" }}>
            <Box
                position="relative"
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="46px"
                h="46px"
                p={0}
                flexShrink={0}
                borderRadius="full"
                border="none"
                cursor={isBusy ? "default" : "pointer"}
                opacity={isBusy ? 0.5 : 1}
                pointerEvents={isBusy ? "none" : "auto"}
                transition="all 0.2s ease"
                outline="none"
                overflow="hidden"
                boxShadow="xl"
                color={PILL.onFill}
                asChild><button
                    aria-label={label}
                    onClick={onStop}
                    disabled={isBusy}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}>
                    {isBusy ? (
                        // Pill's waiting orb, hue-shifted orange → teal
                        <Box
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            bottom={0}
                            pointerEvents="none"
                            filter="hue-rotate(160deg) saturate(0.7)"
                        >
                            <LoadingOrb size={46} />
                        </Box>
                    ) : (
                        <>
                            {/* RecordButton's lava, hue-shifted orange → teal */}
                            <Box
                                position="absolute"
                                top={0}
                                left={0}
                                right={0}
                                bottom={0}
                                borderRadius="full"
                                overflow="hidden"
                                pointerEvents="none"
                                filter="hue-rotate(160deg) saturate(0.7)"
                            >
                                <LavaBlobs />
                            </Box>
                            {/* Pulsing teal glow — the "agent is live" cue */}
                            <InternalGlow rgb="23,146,153" />
                        </>
                    )}
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
                    {/* Icon: wave at rest, stop on hover; hidden while busy */}
                    {!isBusy && (
                        <Box
                            position="absolute"
                            top="50%"
                            left="50%"
                            transform="translate(-50%, -50%)"
                            zIndex={1}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                        >
                            {isHovered ? (
                                <FaStop size={16} />
                            ) : (
                                <FaWaveSquare size={18} />
                            )}
                        </Box>
                    )}
                </button></Box>
        </Tooltip>
    );
};

export const LiveExpandButton = ({
    isExpanded = false,
    onExpand,
    label = "Expand live agent",
    labelExpanded = "Collapse live agent panel",
}) => (
    <Tooltip
        content={isExpanded ? labelExpanded : label}
        showArrow
        positioning={{ placement: "top" }}
    >
        <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="30px"
            h="30px"
            borderRadius="full"
            cursor="pointer"
            outline="none"
            transition="all 0.2s ease"
            color={isExpanded ? PILL.info : "white"}
            bg={isExpanded ? colors.dark.surface : "transparent"}
            _hover={{ bg: colors.dark.surface, transform: "scale(1.05)" }}
            asChild><button
                aria-label={isExpanded ? labelExpanded : label}
                onClick={onExpand}>
                <Box
                    as="span"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    transition="transform 0.2s ease"
                    transform={isExpanded ? "rotate(180deg)" : "none"}
                >
                    <FaExternalLinkAlt size={13} />
                </Box>
            </button></Box>
    </Tooltip>
);

// Borderless side-slot button — the ghost treatment LiveExpandButton and
// the transcript toggle use, shared by the end-of-session pills.
const GhostButton = ({ label, onClick, children }) => (
    <Tooltip content={label} showArrow positioning={{ placement: "top" }}>
        <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="30px"
            h="30px"
            flexShrink={0}
            borderRadius="full"
            border="none"
            cursor="pointer"
            outline="none"
            transition="all 0.2s ease"
            color={PILL.muted}
            bg="transparent"
            _hover={{ bg: colors.dark.surface, transform: "scale(1.05)" }}
            asChild><button aria-label={label} onClick={onClick}>
                {children}
            </button></Box>
    </Tooltip>
);

// Fixed pill footprint shared by the end-of-session pills — matches the
// live pill so the scribe pill never jumps size at the handoff.
const END_STATE_PILL = {
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    className: "pill-box-scribe anim-fade",
    css: { animationDuration: "0.2s" },
    px: 2,
    py: 2,
    gap: 1.5,
    minHeight: "65px",
    w: "182px",
    justify: "center",
};

export const AgentReviewPill = ({
    artifactsCount = 0,
    isExpanded = false,
    canStart = true,
    onBlockedClick,
    onLiveResume,
    onExpand,
    onDismiss,
}) => {
    const [isHovered, setIsHovered] = React.useState(false);
    // Drafts do not survive a resume — startLive starts a fresh session.
    const label =
        artifactsCount > 0
            ? `Resume live session · ${artifactsCount} drafts to review first`
            : "Resume live session";

    const handleClick = () => {
        if (canStart) {
            onLiveResume?.();
        } else {
            onBlockedClick?.();
        }
    };

    return (
        <PillBox {...END_STATE_PILL}>
            <GhostButton label="Close session review" onClick={onDismiss}>
                <FaTimes size={13} />
            </GhostButton>
            <Tooltip content={label} showArrow positioning={{ placement: "top" }}>
                {/* Static teal hero — the lava returns on resume. Doubles as
                    the resume action, consent-gated like the mic. */}
                <Box
                    position="relative"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="46px"
                    h="46px"
                    p={0}
                    flexShrink={0}
                    borderRadius="full"
                    border="none"
                    cursor="pointer"
                    transition="all 0.2s ease"
                    outline="none"
                    overflow="hidden"
                    boxShadow="xl"
                    color={PILL.onFill}
                    bg="radial-gradient(circle at 30% 30%, #45c0b2 0%, #179299 55%, #0d6570 100%)"
                    asChild><button
                        aria-label={label}
                        onClick={handleClick}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}>
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
                        {/* Icon: wave at rest, play on hover */}
                        <Box
                            position="absolute"
                            top="50%"
                            left="50%"
                            transform="translate(-50%, -50%)"
                            zIndex={1}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                        >
                            {isHovered ? (
                                <FaPlay size={14} />
                            ) : (
                                <FaWaveSquare size={18} />
                            )}
                        </Box>
                    </button></Box>
            </Tooltip>
            <LiveExpandButton
                isExpanded={isExpanded}
                onExpand={onExpand}
                label="Open session review"
                labelExpanded="Collapse session review"
            />
        </PillBox>
    );
};

export const AgentErrorPill = ({ onRetry, onDismiss }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const label = "Connection interrupted — reconnect live agent";

    return (
        <PillBox {...END_STATE_PILL}>
            <GhostButton label="Dismiss connection error" onClick={onDismiss}>
                <FaTimes size={13} />
            </GhostButton>
            <Tooltip content={label} showArrow positioning={{ placement: "top" }}>
                {/* Static danger hero — one-click retry, like the live hero stops */}
                <Box
                    position="relative"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="46px"
                    h="46px"
                    p={0}
                    flexShrink={0}
                    borderRadius="full"
                    border="none"
                    cursor="pointer"
                    transition="all 0.2s ease"
                    outline="none"
                    overflow="hidden"
                    boxShadow="xl"
                    color={PILL.onFill}
                    bg="radial-gradient(circle at 30% 30%, #ed8796 0%, #d20f39 55%, #a30d2e 100%)"
                    asChild><button
                        aria-label={label}
                        onClick={onRetry}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}>
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
                        {/* Icon: warning at rest, retry on hover */}
                        <Box
                            position="absolute"
                            top="50%"
                            left="50%"
                            transform="translate(-50%, -50%)"
                            zIndex={1}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                        >
                            {isHovered ? (
                                <FaRedoAlt size={14} />
                            ) : (
                                <FaExclamationTriangle size={15} />
                            )}
                        </Box>
                    </button></Box>
            </Tooltip>
        </PillBox>
    );
};

// Reset button shown in the mode slot while a recording is in progress.
export const ResetButton = ({ onReset }) => {
    const [isHovered, setIsHovered] = React.useState(false);

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
                border={`1px solid ${isHovered ? PILL.warningFill : PILL.warning}`}
                cursor="pointer"
                transition="all 0.2s ease"
                outline="none"
                bg={isHovered ? PILL.warningFill : "transparent"}
                color={isHovered ? PILL.onFill : PILL.warning}
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
};

// Right button: Transcript (idle) / Send (recording)
export const TranscriptSendButton = ({
    isRecording,
    onSend,
    isTranscriptionOpen,
    hasRawTranscription,
}) => {
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
                    border={`1px solid ${isHovered ? PILL.successFill : PILL.success}`}
                    cursor="pointer"
                    transition="all 0.2s ease"
                    outline="none"
                    bg={isHovered ? PILL.successFill : "transparent"}
                    color={isHovered ? PILL.onFill : PILL.success}
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

    // ponytail: no Tooltip here — nesting Tooltip.Trigger around
    // Popover.Trigger makes the tooltip's id/data-scope win on the shared
    // button, so the popover machine can't find its trigger and the panel
    // renders unpositioned (hanging below the viewport). aria-label instead.
    return (
        <Popover.Trigger asChild>
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
                asChild><button aria-label={label}>
                    <FaFileAlt size={14} />
                </button></Box>
        </Popover.Trigger>
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
        className="pill-box-scribe anim-fade"
        css={{ animationDuration: "0.2s" }}
        px={3}
        py={2}
        gap={2}
        minHeight="65px"
    >
        <Tooltip
            content={sendError?.message || "Transcription failed"}
            showArrow
            positioning={{
                placement: "top"
            }}
        >
            <Flex align="center" gap={2} color={PILL.danger} pr={1}>
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
                border={`1px solid ${PILL.success}`}
                cursor="pointer"
                outline="none"
                color={PILL.success}
                bg="transparent"
                transition="all 0.2s ease"
                _hover={{
                    bg: PILL.successFill,
                    borderColor: PILL.successFill,
                    color: PILL.onFill,
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
                border={`1px solid ${PILL.info}`}
                cursor="pointer"
                outline="none"
                color={PILL.info}
                bg="transparent"
                transition="all 0.2s ease"
                _hover={{
                    bg: PILL.infoFill,
                    borderColor: PILL.infoFill,
                    color: PILL.onFill,
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
                color={PILL.muted}
                bg="transparent"
                className="pill-box-icons"
                transition="all 0.2s ease"
                _hover={{ color: PILL.danger, transform: "scale(1.05)" }}
                asChild><button onClick={onDismiss}>
                    <FaTimes size={13} />
                </button></Box>
        </Tooltip>
    </PillBox>
);
