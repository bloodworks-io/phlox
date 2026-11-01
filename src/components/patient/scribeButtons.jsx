import React from "react";
import { Box, Flex, Text, Popover } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Tooltip } from '@/components/ui/tooltip';
import {
    LuAudioWaveform,
    LuBolt,
    LuCheck,
    LuCircle,
    LuDownload,
    LuExternalLink,
    LuFileText,
    LuKeyboard,
    LuMessageCircle,
    LuMic,
    LuPause,
    LuPlay,
    LuRedo2,
    LuSend,
    LuSquare,
    LuTriangleAlert,
    LuX,
} from "react-icons/lu";
import PillBox from "../common/PillBox";
import { InternalGlow, LoadingOrb } from "./scribeVisuals";

const PILL = {
    danger: "folio.danger",
    success: "folio.success",
    warning: "folio.warning",
    info: "folio.info",
    muted: "folio.sidebarMuted",
    dangerFill: "folio.danger",
    successFill: "folio.success",
    warningFill: "folio.warning",
    infoFill: "folio.info",
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
    const { t } = useTranslation();

    const getButtonStyles = () => {
        if (isRecording && !isPaused) {
            return {
                bg: "folio.danger",
                color: "folio.dangerInk",
                boxShadow: "none",
            };
        } else if (isPaused) {
            return {
                bg: "folio.warning",
                color: "folio.warningInk",
                boxShadow: "none",
            };
        } else if (!canStart) {
            return {
                bg: "folio.sidebarAlt",
                color: "folio.sidebarMuted",
                boxShadow: "none",
            };
        } else {
            return {
                bg: "folio.brand",
                color: "folio.brandInk",
                boxShadow: "none",
            };
        }
    };

    const styles = getButtonStyles();

    // Determine what icon to show
    const getIcon = () => {
        if (isRecording && !isPaused) {
            // When recording, show pause on hover, otherwise show circle
            return isHovered ? <LuPause size={20} strokeWidth={1.6} /> : <LuCircle size={20} strokeWidth={1.6} />;
        } else if (isPaused) {
            return <LuPlay size={20} strokeWidth={1.6} />;
        } else {
            return <LuMic size={20} strokeWidth={1.6} />;
        }
    };

    const getLabel = () => {
        if (isRecording && !isPaused) {
            return isHovered ? t("scribe.record.pause") : t("scribe.record.recording");
        } else if (isPaused) {
            return t("scribe.record.resume");
        } else if (!canStart) {
            return t("scribe.record.blockedHint");
        } else {
            return t("scribe.record.start");
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
                transition="color 160ms ease, background-color 160ms ease, border-color 160ms ease, opacity 160ms ease"
                outline="none"
                overflow="hidden"
                boxShadow="none"
                _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "folio.focus",
                    outlineOffset: "2px",
                }}
                {...styles}
                asChild><button
                    aria-label={getLabel()}
                    data-capture-state={
                        isRecording
                            ? isPaused
                                ? "paused"
                                : "recording"
                            : canStart
                              ? "idle"
                              : "blocked"
                    }
                    onClick={handleClick}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}>
                    {/* Flat Folio signature and state ring */}
                    {isRecording && !isPaused && <InternalGlow tone="danger" />}
                    {isPaused && <InternalGlow tone="warning" />}
                    {!isRecording && !isPaused && (
                        <InternalGlow tone="brand" />
                    )}
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
        icon: LuKeyboard,
        label: "scribe.mode.dictate",
        hint: "scribe.mode.dictateHint",
    },
    {
        id: "ambient",
        icon: LuMessageCircle,
        label: "scribe.mode.ambient",
        hint: "scribe.mode.ambientHint",
    },
    {
        id: "agent",
        icon: LuBolt,
        label: "agent.liveAgent",
        hint: "scribe.mode.agentHint",
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
    const { t } = useTranslation();
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
                color="folio.sidebarInk"
                opacity={isBusy ? 0.55 : 1}
                pointerEvents={isBusy ? "none" : "auto"}
                outline="none"
                backgroundColor="transparent"
                transition="color 160ms ease, background-color 160ms ease, opacity 160ms ease"
                _hover={{ backgroundColor: "folio.sidebarAlt" }}
                _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "folio.focus",
                    outlineOffset: "2px",
                }}
                aria-label={t("scribe.mode.aria", { label: t(active.label) })}
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
                                borderRadius="folioControl"
                                border="none"
                                bg={isActive ? "folio.accentSoft" : "transparent"}
                                cursor={isActive ? "default" : "pointer"}
                                textAlign="left"
                                color={isActive ? "folio.ink" : "folio.muted"}
                                outline="none"
                                transition="color 160ms ease, background-color 160ms ease"
                                _hover={
                                    isActive
                                        ? undefined
                                        : { bg: "folio.hover", color: "folio.ink" }
                                }
                                _focusVisible={{
                                    outline: "2px solid",
                                    outlineColor: "folio.focus",
                                    outlineOffset: "2px",
                                }}
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
                                    color={isActive ? "folio.accent" : "folio.muted"}
                                    bg="folio.paperAlt"
                                >
                                    <Icon size={12} />
                                </Box>
                                <Box as="span" flex="1">
                                    <Text
                                        fontSize="xs"
                                        fontWeight="700"
                                        color={isActive ? "folio.ink" : "folio.muted"}
                                    >
                                        {t(entry.label)}
                                    </Text>
                                    <Text
                                        fontSize="10px"
                                        color="folio.faint"
                                        lineHeight="1.3"
                                    >
                                        {t(entry.hint)}
                                    </Text>
                                </Box>
                                {isActive && (
                                    <Box
                                        as="span"
                                        display="flex"
                                        alignItems="center"
                                        flexShrink={0}
                                        color="folio.accent"
                                    >
                                        <LuCheck size={10} strokeWidth={1.6} />
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
    const { t } = useTranslation();
    const isBusy = status === "connecting" || status === "stopping";
    const label =
        status === "connecting"
            ? t("scribe.agent.warmingUp")
            : status === "stopping"
              ? t("agent.status.wrappingUp")
              : t("scribe.agent.end");

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
                opacity={isBusy ? 0.55 : 1}
                pointerEvents={isBusy ? "none" : "auto"}
                transition="color 160ms ease, background-color 160ms ease, opacity 160ms ease"
                outline="none"
                overflow="hidden"
                boxShadow="none"
                bg={isBusy ? "folio.sidebarAlt" : "folio.info"}
                color={isBusy ? "folio.sidebarMuted" : "folio.infoInk"}
                _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "folio.focus",
                    outlineOffset: "2px",
                }}
                asChild><button
                    aria-label={label}
                    data-live-status={status}
                    onClick={onStop}
                    disabled={isBusy}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}>
                    {isBusy ? (
                        <LoadingOrb size={46} tone="muted" label={label} />
                    ) : (
                        <InternalGlow tone="info" />
                    )}
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
                                <LuSquare size={16} strokeWidth={1.6} />
                            ) : (
                                <LuAudioWaveform size={18} strokeWidth={1.6} />
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
    label,
    labelExpanded,
}) => {
    const { t } = useTranslation();
    const expandLabel = label ?? t("agent.expand.expand");
    const collapseLabel = labelExpanded ?? t("agent.expand.collapsePanel");
    return (
    <Tooltip
        content={isExpanded ? collapseLabel : expandLabel}
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
            transition="color 160ms ease, background-color 160ms ease"
            color={isExpanded ? PILL.info : "folio.sidebarInk"}
            bg={isExpanded ? "folio.sidebarAlt" : "transparent"}
            _hover={{ bg: "folio.sidebarAlt", color: isExpanded ? PILL.info : "folio.sidebarInk" }}
            _focusVisible={{
                outline: "2px solid",
                outlineColor: "folio.focus",
                outlineOffset: "2px",
            }}
            asChild><button
                aria-label={isExpanded ? collapseLabel : expandLabel}
                onClick={onExpand}>
                <Box
                    as="span"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    transition="transform 0.2s ease"
                    transform={isExpanded ? "rotate(180deg)" : "none"}
                >
                    <LuExternalLink size={13} strokeWidth={1.6} />
                </Box>
            </button></Box>
    </Tooltip>
    );
};

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
            transition="color 160ms ease, background-color 160ms ease"
            color={PILL.muted}
            bg="transparent"
            _hover={{ bg: "folio.sidebarAlt", color: "folio.sidebarInk" }}
            _focusVisible={{
                outline: "2px solid",
                outlineColor: "folio.focus",
                outlineOffset: "2px",
            }}
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
    const { t } = useTranslation();
    // Drafts do not survive a resume — startLive starts a fresh session.
    const label =
        artifactsCount > 0
            ? t("agent.review.resumeWithDrafts", { count: artifactsCount })
            : t("agent.review.resume");

    const handleClick = () => {
        if (canStart) {
            onLiveResume?.();
        } else {
            onBlockedClick?.();
        }
    };

    return (
        <PillBox {...END_STATE_PILL}>
            <GhostButton
                label={t("agent.panel.closeSession")}
                onClick={onDismiss}
            >
                <LuX size={13} strokeWidth={1.6} />
            </GhostButton>
            <Tooltip content={label} showArrow positioning={{ placement: "top" }}>
                {/* Static review hero; doubles as the resume action and is
                    consent-gated like the mic. */}
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
                    border="1px solid"
                    borderColor={PILL.info}
                    cursor="pointer"
                    transition="color 160ms ease, background-color 160ms ease, border-color 160ms ease"
                    outline="none"
                    overflow="hidden"
                    boxShadow="none"
                    color={PILL.info}
                    backgroundColor="folio.sidebarAlt"
                    _focusVisible={{
                        outline: "2px solid",
                        outlineColor: "folio.focus",
                        outlineOffset: "2px",
                    }}
                    asChild><button
                        aria-label={label}
                        data-live-status="review"
                                                onClick={handleClick}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
>
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
                                <LuPlay size={14} strokeWidth={1.6} />
                            ) : (
                                <LuAudioWaveform size={18} strokeWidth={1.6} />
                            )}
                        </Box>
                    </button></Box>
            </Tooltip>
            <LiveExpandButton
                isExpanded={isExpanded}
                onExpand={onExpand}
                label={t("agent.review.openPanel")}
                labelExpanded={t("agent.review.collapsePanel")}
            />
        </PillBox>
    );
};

export const AgentErrorPill = ({ onRetry, onDismiss }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const { t } = useTranslation();
    const label = t("agent.error.reconnectLive");

    return (
        <PillBox {...END_STATE_PILL}>
            <GhostButton
                label={t("agent.error.dismissError")}
                onClick={onDismiss}
            >
                <LuX size={13} strokeWidth={1.6} />
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
                    border="1px solid"
                    borderColor={PILL.danger}
                    cursor="pointer"
                    transition="color 160ms ease, background-color 160ms ease, border-color 160ms ease"
                    outline="none"
                    overflow="hidden"
                    boxShadow="none"
                    color={PILL.danger}
                    backgroundColor="folio.sidebarAlt"
                    _focusVisible={{
                        outline: "2px solid",
                        outlineColor: "folio.focus",
                        outlineOffset: "2px",
                    }}
                    asChild><button
                        aria-label={label}
                        data-live-status="error"
                        onClick={onRetry}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}>
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
                                <LuRedo2 size={14} />
                            ) : (
                                <LuTriangleAlert size={15} strokeWidth={1.6} />
                            )}
                        </Box>
                    </button></Box>
            </Tooltip>
        </PillBox>
    );
};

// Reset button shown in the mode slot while a recording is in progress.
export const ResetButton = ({ onReset }) => {
    const { t } = useTranslation();

    return (
        <Tooltip content={t("scribe.reset")} showArrow positioning={{
            placement: "top"
        }}>
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="40px"
                h="40px"
                borderRadius="full"
                border="1px solid"
                borderColor={PILL.warning}
                cursor="pointer"
                transition="color 160ms ease, background-color 160ms ease, border-color 160ms ease"
                outline="none"
                bg="transparent"
                color={PILL.warning}
                boxShadow="none"
                _hover={{
                    bg: PILL.warningFill,
                    borderColor: PILL.warningFill,
                    color: "folio.warningInk",
                }}
                _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "folio.focus",
                    outlineOffset: "2px",
                }}
                asChild><button
                    aria-label={t("scribe.reset")}
                    onClick={onReset}
                >
                    <LuX size={16} strokeWidth={1.6} />
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
    const { t } = useTranslation();

    if (isRecording) {
        // Send button state
        return (
            <Tooltip content={t("scribe.send.stopAndSend")} showArrow positioning={{
                placement: "top"
            }}>
                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="40px"
                    h="40px"
                    borderRadius="full"
                    border="1px solid"
                    borderColor={PILL.success}
                    cursor="pointer"
                    transition="color 160ms ease, background-color 160ms ease, border-color 160ms ease"
                    outline="none"
                    bg="transparent"
                    color={PILL.success}
                    boxShadow="none"
                    _hover={{
                        bg: PILL.successFill,
                        borderColor: PILL.successFill,
                        color: "folio.successInk",
                    }}
                    _focusVisible={{
                        outline: "2px solid",
                        outlineColor: "folio.focus",
                        outlineOffset: "2px",
                    }}
                    asChild><button
                        aria-label={t("scribe.send.stopAndSend")}
                        onClick={onSend}
                    >
                        <LuSend size={14} strokeWidth={1.6} />
                    </button></Box>
            </Tooltip>
        );
    }

    // Transcript button state
    const isDisabled = !hasRawTranscription;
    const label = isDisabled
        ? t("scribe.transcript.none")
        : t("agent.panel.transcript");

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
                flexShrink={0}
                mr={0}
                cursor={isDisabled ? "not-allowed" : "pointer"}
                transition="color 160ms ease, background-color 160ms ease, opacity 160ms ease"
                outline="none"
                opacity={isDisabled ? 0.4 : 1}
                color={isTranscriptionOpen ? "folio.accent" : "folio.sidebarInk"}
                bg={isTranscriptionOpen ? "folio.accentSoft" : "transparent"}
                _hover={
                    isDisabled
                        ? {}
                        : {
                              bg: "folio.accentSoft",
                              color: "folio.accent",
                          }
                }
                _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "folio.focus",
                    outlineOffset: "2px",
                }}
                pointerEvents={isDisabled ? "none" : "auto"}
                asChild><button aria-label={label} aria-disabled={isDisabled}>
                    <LuFileText size={14} strokeWidth={1.6} />
                </button></Box>
        </Popover.Trigger>
    );
};

export const TranscriptionFailurePill = ({
    sendError,
    onRetry,
    onDownload,
    onDismiss,
}) => {
    const { t } = useTranslation();

    return (
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
            content={sendError?.message || t("scribe.transcription.failed")}
            showArrow
            positioning={{
                placement: "top"
            }}
        >
            <Flex align="center" gap={2} color={PILL.danger} pr={1}>
                <LuTriangleAlert size={15} strokeWidth={1.6} />
                <Text fontSize="xs" fontWeight="700">
                    {t("scribe.transcription.failed")}
                </Text>
            </Flex>
        </Tooltip>
        <Tooltip content={t("scribe.transcription.retrySend")} showArrow positioning={{
            placement: "top"
        }}>
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="32px"
                h="32px"
                borderRadius="full"
                border="1px solid"
                borderColor={PILL.success}
                cursor="pointer"
                outline="none"
                color={PILL.success}
                bg="transparent"
                transition="color 160ms ease, background-color 160ms ease, border-color 160ms ease"
                _hover={{
                    bg: PILL.successFill,
                    borderColor: PILL.successFill,
                    color: "folio.successInk",
                }}
                _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "folio.focus",
                    outlineOffset: "2px",
                }}
                asChild><button
                    aria-label={t("scribe.transcription.retrySend")}
                    onClick={onRetry}
                >
                    <LuRedo2 size={13} />
                </button></Box>
        </Tooltip>
        <Tooltip content={t("scribe.transcription.downloadAudio")} showArrow positioning={{
            placement: "top"
        }}>
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="32px"
                h="32px"
                borderRadius="full"
                border="1px solid"
                borderColor={PILL.info}
                cursor="pointer"
                outline="none"
                color={PILL.info}
                bg="transparent"
                transition="color 160ms ease, background-color 160ms ease, border-color 160ms ease"
                _hover={{
                    bg: PILL.infoFill,
                    borderColor: PILL.infoFill,
                    color: "folio.infoInk",
                }}
                _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "folio.focus",
                    outlineOffset: "2px",
                }}
                asChild><button
                    aria-label={t("scribe.transcription.downloadAudio")}
                    onClick={onDownload}
                >
                    <LuDownload size={13} strokeWidth={1.6} />
                </button></Box>
        </Tooltip>
        <Tooltip
            content={t("scribe.transcription.dismissWarning")}
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
                flexShrink={0}
                mr={2}
                cursor="pointer"
                outline="none"
                color={PILL.muted}
                bg="transparent"
                transition="color 160ms ease, background-color 160ms ease"
                _hover={{ color: PILL.danger, bg: "folio.dangerSoft" }}
                _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "folio.focus",
                    outlineOffset: "2px",
                }}
                asChild><button
                    aria-label={t("scribe.transcription.dismissWarning")}
                    onClick={onDismiss}
                >
                    <LuX size={13} strokeWidth={1.6} />
                </button></Box>
        </Tooltip>
    </PillBox>
    );
};
