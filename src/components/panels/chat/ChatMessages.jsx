import React, { useMemo, useState } from "react";
import { useColorMode } from "../../ui/color-mode";
import { Flex, Box, Text, HStack, VStack, Spinner, Image } from "@chakra-ui/react";
import {
    parseMessageContent,
    buildCitationRemap,
} from "../../../utils/chat/messageParser";
import { groupActivityTrace } from "../../../utils/chat/activityTrace";
import ActivityTraceBlock from "../../common/ActivityTraceBlock";
import MarkdownRenderer from "../../common/MarkdownRenderer";
import ArtifactCard from "../../common/ArtifactCard";
import FormFillArtifact from "../../pdf-forms/FormFillArtifact";
import { CitationList } from "../reasoning/components/CitationList";

const ChatMessages = ({
    messages,
    toggleThinkingVisibility,
    getThinkingBlockState,
}) => {
    const [expandedToolBlocks, setExpandedToolBlocks] = useState({});
    const { colorMode } = useColorMode();

    const filteredMessages = useMemo(
        () =>
            messages
                .map((message, messageIndex) => ({ message, messageIndex }))
                .filter(({ message }) => message.role !== "system"),
        [messages],
    );

    const getToolExpanded = (messageIndex, blockIndex) =>
        Boolean(expandedToolBlocks[`${messageIndex}:${blockIndex}`]);

    const toggleToolExpanded = (messageIndex, blockIndex) => {
        const key = `${messageIndex}:${blockIndex}`;
        setExpandedToolBlocks((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    if (filteredMessages.length === 0) {
        return null;
    }

    return (
        <>
            {filteredMessages.map(({ message, messageIndex }) => {
                if (message.role === "system") return null;

                const parsed = parseMessageContent(message.content || "");
                const rawBlocks =
                    parsed?.blocks && parsed.blocks.length > 0
                        ? parsed.blocks
                        : [{ type: "text", content: message.content || "" }];

                const blocks = groupActivityTrace(rawBlocks);

                const allCitations = Object.values(
                    message.context || {},
                ).filter(Boolean);
                const { remap, citedOriginals } = buildCitationRemap(
                    parsed?.visibleText || "",
                );
                const footerOriginals =
                    citedOriginals.length > 0 ? citedOriginals : null;

                return (
                    <Flex
                        key={messageIndex}
                        justify={
                            message.role === "assistant"
                                ? "flex-start"
                                : "flex-end"
                        }
                        mb="2"
                    >
                        <Box
                            className={`message-box ${message.role}`}
                            px={message.role === "assistant" ? "1" : "3"}
                            py={message.role === "assistant" ? "1" : "2"}
                            maxWidth={
                                message.role === "assistant" ? "92%" : "85%"
                            }
                            bg={
                                message.role === "assistant"
                                    ? "transparent"
                                    : undefined
                            }
                            borderWidth={
                                message.role === "assistant" ? "0" : undefined
                            }
                            boxShadow={
                                message.role === "assistant"
                                    ? "none"
                                    : undefined
                            }
                            fontSize="sm"
                            position="relative"
                        >
                            {message.loading ? (
                                <Spinner size="sm" mt="1" />
                            ) : (
                                <VStack
                                    align="start"
                                    gap={0.25}
                                    width="100%"
                                >
                                    {message.role === "assistant" && (
                                        <HStack gap={1.5} mb={0.5}>
                                            <Image
                                                src="/logo.webp"
                                                alt="Phlox Assistant"
                                                boxSize="14px"
                                                objectFit="contain"
                                            />
                                            <Text
                                                fontSize="xs"
                                                fontWeight="semibold"
                                                color="overlay0"
                                                lineHeight="1"
                                            >
                                                Phlox Assistant
                                            </Text>
                                        </HStack>
                                    )}

                                    {blocks.map((block, blockIndex) => {
                                        if (
                                            block.type === "activity-trace"
                                        ) {
                                            return (
                                                <ActivityTraceBlock
                                                    key={`trace-${messageIndex}-${blockIndex}`}
                                                    traceBlocks={
                                                        block.traceBlocks
                                                    }
                                                    currentActivity={
                                                        block.currentActivity
                                                    }
                                                    messageIndex={
                                                        messageIndex
                                                    }
                                                    message={message}
                                                    getThinkingBlockState={
                                                        getThinkingBlockState
                                                    }
                                                    toggleThinkingVisibility={
                                                        toggleThinkingVisibility
                                                    }
                                                    expandedToolBlocks={
                                                        expandedToolBlocks
                                                    }
                                                    toggleToolExpanded={
                                                        toggleToolExpanded
                                                    }
                                                />
                                            );
                                        }

                                        // text block
                                        if (!block.content) return null;
                                        return (
                                            <Box
                                                fontSize="sm"
                                                key={`text-${messageIndex}-${blockIndex}`}
                                                width="100%"
                                            >
                                                <MarkdownRenderer
                                                    citations={allCitations}
                                                    citationRemap={remap}
                                                >
                                                    {block.content}
                                                </MarkdownRenderer>
                                            </Box>
                                        );
                                    })}

                                    {message.role === "assistant" &&
                                        message.context && (
                                            <CitationList
                                                citations={allCitations}
                                                citedOriginals={footerOriginals}
                                                colorMode={colorMode}
                                                inline
                                            />
                                        )}

                                    {message.role === "assistant" &&
                                        message.artifacts &&
                                        message.artifacts.length > 0 && (
                                            <VStack
                                                align="start"
                                                gap={1}
                                                mt={1}
                                                width="100%"
                                            >
                                                {message.artifacts.map(
                                                    (artifact, idx) =>
                                                        artifact.type === "form_fill" ? (
                                                            <FormFillArtifact
                                                                key={`artifact-${messageIndex}-${idx}`}
                                                                artifact={artifact}
                                                            />
                                                        ) : (
                                                            <ArtifactCard
                                                                key={`artifact-${messageIndex}-${idx}`}
                                                                artifact={artifact}
                                                            />
                                                        ),
                                                )}
                                            </VStack>
                                        )}
                                </VStack>
                            )}
                        </Box>
                    </Flex>
                );
            })}
        </>
    );
};

export default ChatMessages;
