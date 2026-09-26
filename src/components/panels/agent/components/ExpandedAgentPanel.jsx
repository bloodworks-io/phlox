import React, { useState } from "react";
import { Box, Text, HStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/tooltip";
import { FaChevronUp, FaChevronDown, FaTimes } from "react-icons/fa";

import { AgentSymbol, StatusDot } from "./agentVisuals";
import { getStatusInfo, getContextLine } from "./agentStatus";
import { ActivityList } from "./ActivityList";
import { ArtifactRow } from "./ArtifactRow";
import { TranscriptSection } from "./TranscriptSection";
import { ErrorBlock } from "./ErrorBlock";

export const ExpandedAgentPanel = ({
    status,
    agentState,
    transcripts,
    statuses,
    artifacts,
    lastError,
    onToggleExpand,
    onOpenLetter,
    onRetry,
    onDismissReview,
    dragHandlers,
}) => {
    const { t } = useTranslation();
    const info = getStatusInfo(status, agentState);
    const isReview = status === "review";
    const isError = status === "error";
    const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

    return (
        <Box
            className="floating-panel"
            display="flex"
            flexDirection="column"
            overflow="hidden"
            maxHeight="65vh"
        >
            {/* Header — drag handle */}
            <Box
                display="flex"
                alignItems="center"
                gap={2.5}
                flexShrink={0}
                px={3}
                py={2.5}
                borderBottomWidth="1px"
                borderColor="surface"
                cursor="grab"
                userSelect="none"
                _active={{ cursor: "grabbing" }}
                {...dragHandlers}
            >
                <AgentSymbol pulse={info.pulse} />
                <Box flex="1" minW="0">
                    <Text fontWeight="semibold" fontSize="sm" lineHeight="1.3">
                        {t("agent.liveAgent")}
                    </Text>
                    <HStack gap={1.5} mt="2px">
                        <StatusDot color={info.color} pulse={info.pulse} />
                        <Text fontSize="xs" color="fg.subtle" truncate minW="0">
                            {info.label}
                        </Text>
                    </HStack>
                </Box>
                {isReview && (
                    <Tooltip
                        content={t("agent.panel.closeReview")}
                        showArrow
                        positioning={{ placement: "top" }}
                    >
                        <Box
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            w="32px"
                            h="32px"
                            borderRadius="full"
                            color="fg.subtle"
                            cursor="pointer"
                            flexShrink={0}
                            transition="all 0.2s ease"
                            _hover={{ bg: "surface", color: "fg.muted" }}
                            asChild
                        >
                            <button
                                aria-label={t("agent.panel.closeSession")}
                                onClick={onDismissReview}
                            >
                                <FaTimes size="11px" />
                            </button>
                        </Box>
                    </Tooltip>
                )}
                <Tooltip
                    content={t("agent.panel.collapseToCard")}
                    showArrow
                    positioning={{ placement: "top" }}
                >
                    <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        w="32px"
                        h="32px"
                        borderRadius="full"
                        color="fg.subtle"
                        cursor="pointer"
                        flexShrink={0}
                        transition="all 0.2s ease"
                        _hover={{ bg: "surface", color: "fg.muted" }}
                        asChild
                    >
                        <button
                            aria-label={t("agent.panel.collapse")}
                            onClick={onToggleExpand}
                        >
                            <FaChevronDown size="11px" />
                        </button>
                    </Box>
                </Tooltip>
            </Box>

            {/* Body — what changed and what is ready come first. */}
            <Box
                className="slim-scrollbar"
                p={3}
                flex="1"
                minHeight="0"
                overflowY="auto"
                display="flex"
                flexDirection="column"
                gap={3}
            >
                {isError ? (
                    <ErrorBlock
                        message={lastError}
                        onRetry={onRetry}
                        onDismiss={onDismissReview}
                    />
                ) : (
                    <>
                        <Box flexShrink={0}>
                            <Text className="live-section-label" mb={2}>
                                {t("agent.panel.latestActivity")}
                            </Text>
                            {statuses.length === 0 ? (
                                <Text
                                    fontSize="xs"
                                    fontStyle="italic"
                                    color="overlay0"
                                >
                                    {status === "connecting"
                                        ? t("agent.panel.loadingContext")
                                        : t("agent.panel.waitingUpdates")}
                                </Text>
                            ) : (
                                <ActivityList statuses={statuses} />
                            )}
                        </Box>

                        {artifacts.length > 0 && (
                            <Box flexShrink={0}>
                                <Text className="live-section-label" mb={2}>
                                    {t("agent.panel.preparedForReview", {
                                        count: artifacts.length,
                                    })}
                                </Text>
                                {artifacts.map((artifact, index) => (
                                    <ArtifactRow
                                        key={`${artifact.type}-${index}-${artifact.content?.length ?? 0}-${artifact.saved}`}
                                        artifact={artifact}
                                        onOpenLetter={onOpenLetter}
                                    />
                                ))}
                            </Box>
                        )}
                    </>
                )}
            </Box>

            {isTranscriptOpen && (
                <Box
                    id="live-agent-transcript"
                    className="slim-scrollbar"
                    px={3}
                    pb={3}
                    flexShrink={0}
                    maxHeight="190px"
                    overflowY="auto"
                >
                    <Text className="live-section-label" mb={2}>
                        {t("agent.panel.transcript")}
                    </Text>
                    <TranscriptSection transcripts={transcripts} />
                </Box>
            )}

            {/* Footer */}
            <Box
                flexShrink={0}
                px={3}
                py={2}
                borderTopWidth="1px"
                borderColor="surface"
                display="flex"
                alignItems="center"
                gap={2}
            >
                <Box
                    as="button"
                    display="inline-flex"
                    alignItems="center"
                    gap={1.5}
                    px={2}
                    py={1.5}
                    borderRadius="6px"
                    fontSize="xs"
                    color="fg.subtle"
                    cursor="pointer"
                    transition="all 0.15s ease"
                    _hover={{ bg: "surface", color: "fg.muted" }}
                    aria-expanded={isTranscriptOpen}
                    aria-controls="live-agent-transcript"
                    onClick={() => setIsTranscriptOpen((open) => !open)}
                >
                    {isTranscriptOpen ? (
                        <FaChevronDown size="10px" />
                    ) : (
                        <FaChevronUp size="10px" />
                    )}
                    {t("agent.panel.transcript")}
                </Box>
                <Text
                    fontSize="xs"
                    color="overlay0"
                    ml="auto"
                    textAlign="right"
                    truncate
                >
                    {getContextLine(status)}
                </Text>
            </Box>
        </Box>
    );
};
