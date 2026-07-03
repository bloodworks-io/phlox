import React, { useState } from "react";
import { useColorMode } from "../ui/color-mode";
import { Box, Flex, VStack, HStack, Text, Spinner, Badge, Icon, Image } from "@chakra-ui/react";
import { AttachmentIcon } from "../common/icons";
import { FaFilePdf, FaFileImage } from "react-icons/fa";
import MarkdownRenderer from "../common/MarkdownRenderer";
import ArtifactCard from "../common/ArtifactCard";
import { parseMessageContent } from "../../utils/chat/messageParser";
import { groupActivityTrace } from "../../utils/chat/activityTrace";
import ActivityTraceBlock from "../common/ActivityTraceBlock";
import { CitationList } from "../panels/reasoning/components/CitationList";

const DashboardMessageList = ({
    visibleMessages = [],
    setMessages,
    messagesEndRef,
}) => {
    const [expandedToolBlocks, setExpandedToolBlocks] = useState({});
    const { colorMode } = useColorMode();

    const getThinkingBlockState = (message, blockIndex = 0) => {
        if (!message) return false;
        const expandedMap = message.thinkingExpandedBlocks || {};
        return Boolean(expandedMap[blockIndex]);
    };

    const toggleThinkingVisibility = (messageIndex, blockIndex = 0) => {
        if (!setMessages) return;

        setMessages((prevMessages) =>
            prevMessages.map((msg, idx) => {
                if (idx !== messageIndex) return msg;

                const currentMap = msg.thinkingExpandedBlocks || {};
                const nextExpanded = !currentMap[blockIndex];

                return {
                    ...msg,
                    thinkingExpandedBlocks: {
                        ...currentMap,
                        [blockIndex]: nextExpanded,
                    },
                    isThinkingExpanded:
                        blockIndex === 0
                            ? nextExpanded
                            : msg.isThinkingExpanded,
                };
            }),
        );
    };

    const toggleToolExpanded = (messageIndex, blockIndex) => {
        const key = `${messageIndex}:${blockIndex}`;
        setExpandedToolBlocks((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    return (
        <VStack
            gap={2}
            align="stretch"
            w="100%"
            maxW="800px"
            mx="auto"
            px="20px"
        >
            {visibleMessages.map(({ message, messageIndex }) => {
                const parsed = parseMessageContent(message.content || "");
                const rawBlocks =
                    parsed?.blocks && parsed.blocks.length > 0
                        ? parsed.blocks
                        : [{ type: "text", content: message.content || "" }];

                const blocks = groupActivityTrace(rawBlocks);

                return (
                    <Flex
                        key={`message-${messageIndex}`}
                        justify={
                            message.role === "assistant"
                                ? "flex-start"
                                : "flex-end"
                        }
                    >
                        <Box
                            className={`message-box ${message.role}`}
                            maxWidth={message.role === "assistant" ? "92%" : "80%"}
                            px={message.role === "assistant" ? 0 : 3}
                            py={message.role === "assistant" ? 0 : 2}
                            bg={message.role === "assistant" ? "transparent" : undefined}
                            borderWidth={message.role === "assistant" ? "0" : undefined}
                            boxShadow={message.role === "assistant" ? "none" : undefined}
                            position="relative"
                        >
                            {message.loading ? (
                                <Spinner size="sm" />
                            ) : (
                                <VStack align="start" gap={0.5} width="100%">
                                    {message.role === "assistant" && (
                                        <HStack gap={2} mb={0.5}>
                                            <Image
                                                src="/logo.webp"
                                                alt="Phlox Logo"
                                                h="16px"
                                                w="auto"
                                                objectFit="contain"
                                            />
                                            <Text
                                                fontSize="xs"
                                                fontWeight="semibold"
                                                color="gray.500"
                                            >
                                                Phlox Assistant
                                            </Text>
                                        </HStack>
                                    )}

                                    {message.role === "user" &&
                                        message.attachments?.length > 0 && (
                                            <HStack gap={1} mb={1} flexWrap="wrap">
                                                {message.attachments.map((att, i) => {
                                                    const isPdf =
                                                        att.type === "application/pdf";
                                                    const isImage =
                                                        att.type?.startsWith("image/");

                                                    return (
                                                        <Badge
                                                            key={i}
                                                            size="sm"
                                                            variant="subtle"
                                                            colorPalette={
                                                                isPdf
                                                                    ? "red"
                                                                    : isImage
                                                                      ? "blue"
                                                                      : "gray"
                                                            }
                                                            borderRadius="md"
                                                            px={2}
                                                            py={1}
                                                        >
                                                            <Icon
                                                                as={
                                                                    isPdf
                                                                        ? FaFilePdf
                                                                        : isImage
                                                                          ? FaFileImage
                                                                          : AttachmentIcon
                                                                }
                                                                mr={1}
                                                            />
                                                            {att.filename}
                                                        </Badge>
                                                    );
                                                })}
                                            </HStack>
                                        )}

                                    {blocks.map((block, blockIndex) => {
                                        if (block.type === "activity-trace") {
                                            return (
                                                <ActivityTraceBlock
                                                    key={`trace-${messageIndex}-${blockIndex}`}
                                                    traceBlocks={block.traceBlocks}
                                                    currentActivity={block.currentActivity}
                                                    messageIndex={messageIndex}
                                                    message={message}
                                                    getThinkingBlockState={getThinkingBlockState}
                                                    toggleThinkingVisibility={toggleThinkingVisibility}
                                                    expandedToolBlocks={expandedToolBlocks}
                                                    toggleToolExpanded={toggleToolExpanded}
                                                />
                                            );
                                        }

                                        if (!block.content) return null;

                                        return (
                                            <Box
                                                fontSize="sm"
                                                key={`text-${messageIndex}-${blockIndex}`}
                                                width="100%"
                                            >
                                                <MarkdownRenderer>
                                                    {block.content}
                                                </MarkdownRenderer>
                                            </Box>
                                        );
                                    })}

                                    {message.role === "assistant" &&
                                        message.context && (
                                            <CitationList
                                                citations={Object.values(
                                                    message.context,
                                                ).filter(Boolean)}
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
                                                    (artifact, idx) => (
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
            <div ref={messagesEndRef} />
        </VStack>
    );
};

export default DashboardMessageList;
