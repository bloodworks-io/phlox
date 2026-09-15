import React, { useEffect, useRef } from "react";
import { Box, Flex, Text, Button, Badge, HStack } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { FaStop, FaBolt, FaFileAlt } from "react-icons/fa";

import FloatingPanel from "../../common/FloatingPanel";
import ArtifactCard from "../../common/ArtifactCard";
import FormFillArtifact from "../../pdf-forms/FormFillArtifact";

const STATUS_COLORS = {
    info: "overlay0",
    edit: "blue.solid",
    command: "green.solid",
    artifact: "purple.solid",
};

const AgentPanel = ({
    isOpen,
    status,
    agentState,
    transcripts,
    statuses,
    artifacts,
    onStop,
}) => {
    const transcriptEndRef = useRef(null);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ block: "end" });
    }, [transcripts.length, isOpen]);

    const isTidy = status === "tidy";
    const isActive = ["connecting", "live", "tidy", "stopping"].includes(status);

    const statusLabel = () => {
        if (status === "connecting") return "Connecting…";
        if (status === "stopping") return "Wrapping up…";
        if (isTidy) return agentState === "working" ? "Applying…" : "Tidy mode";
        if (status === "live")
            return agentState === "working" ? "Thinking…" : "Listening…";
        return "Idle";
    };

    return (
        <FloatingPanel
            isOpen={isOpen}
            position="bottom-center"
            showArrow={false}
            width="340px"
            height="420px"
            maxHeight="60vh"
        >
            <Box
                p={3}
                height="100%"
                display="flex"
                flexDirection="column"
                gap={2}
                backdropFilter="blur(12px)"
                borderRadius="xl"
                css={{
                    "&::-webkit-scrollbar": { width: "4px" },
                    "&::-webkit-scrollbar-track": { background: "transparent" },
                    "&::-webkit-scrollbar-thumb": {
                        background: "var(--chakra-colors-scrollbar-thumb)",
                        borderRadius: "24px",
                    },
                }}
            >
                {/* Header */}
                <Flex align="center" justify="space-between" flexShrink={0}>
                    <HStack gap={2}>
                        <FaBolt size="1em" />
                        <Text fontWeight="bold" fontSize="sm">
                            Live Scribe
                        </Text>
                        <Badge
                            fontSize="2xs"
                            colorPalette={
                                !isActive
                                    ? "gray"
                                    : isTidy
                                      ? "green"
                                      : agentState === "working"
                                        ? "orange"
                                        : "blue"
                            }
                            variant="subtle"
                        >
                            {statusLabel()}
                        </Badge>
                    </HStack>
                    {isActive && (
                        <Tooltip content="End live session">
                            <Button
                                size="xs"
                                colorPalette="red"
                                variant="surface"
                                onClick={onStop}
                                loading={status === "stopping"}
                            >
                                <FaStop size="9px" />End
                            </Button>
                        </Tooltip>
                    )}
                </Flex>

                {/* Live transcript */}
                <Box
                    flex="1"
                    overflowY="auto"
                    minHeight="80px"
                    p={2}
                    borderRadius="md"
                    bg="surfaceInset"
                    fontSize="xs"
                    css={{
                        "&::-webkit-scrollbar": { width: "4px" },
                        "&::-webkit-scrollbar-thumb": {
                            background:
                                "var(--chakra-colors-scrollbar-thumb)",
                        },
                    }}
                >
                    {transcripts.length === 0 ? (
                        <Text color="overlay0" fontStyle="italic">
                            {isActive
                                ? isTidy
                                    ? "Speak a command to edit the note…"
                                    : "Waiting for speech…"
                                : "Start a live session from the mic pill."}
                        </Text>
                    ) : (
                        transcripts.map((text, index) => (
                            <Text key={index} mb={1} color="fg.muted">
                                {text}
                            </Text>
                        ))
                    )}
                    <div ref={transcriptEndRef} />
                </Box>

                {/* Agent activity */}
                {statuses.length > 0 && (
                    <Box flexShrink={0} maxHeight="110px" overflowY="auto">
                        {statuses.map((item) => (
                            <HStack key={item.id} gap={2} alignItems="flex-start">
                                <Box
                                    mt="6px"
                                    w="5px"
                                    h="5px"
                                    borderRadius="full"
                                    flexShrink={0}
                                    bg={STATUS_COLORS[item.kind] || "overlay0"}
                                />
                                <Text fontSize="xs" color="fg.subtle">
                                    {item.content}
                                </Text>
                            </HStack>
                        ))}
                    </Box>
                )}

                {/* Staged artifacts */}
                {artifacts.length > 0 && (
                    <Box flexShrink={0} pt={1} borderTopWidth="1px" borderColor="border">
                        <HStack gap={1} mb={1}>
                            <FaFileAlt size="0.8em" />
                            <Text fontSize="xs" fontWeight="semibold">
                                Prepared for review ({artifacts.length})
                            </Text>
                        </HStack>
                        {artifacts.map((artifact, index) =>
                            artifact.type === "form_fill" ? (
                                <FormFillArtifact
                                    key={`form-${index}`}
                                    artifact={artifact}
                                />
                            ) : (
                                <ArtifactCard
                                    key={`file-${index}`}
                                    artifact={artifact}
                                />
                            ),
                        )}
                    </Box>
                )}
            </Box>
        </FloatingPanel>
    );
};

export default AgentPanel;
