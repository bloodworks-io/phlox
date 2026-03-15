import React, { useMemo, useState } from "react";
import {
    Flex,
    Box,
    Text,
    HStack,
    VStack,
    IconButton,
    Collapse,
    Tooltip,
    Spinner,
    Badge,
    Image,
} from "@chakra-ui/react";
import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import {
    FaTools,
    FaWikipediaW,
    FaBookMedical,
    FaSearch,
    FaFileAlt,
    FaRegCommentDots,
} from "react-icons/fa";
import { parseMessageContent } from "../../../utils/chat/messageParser";
import MarkdownRenderer from "../../common/MarkdownRenderer";

const getToolName = (toolBlock) => {
    const attrs = toolBlock?.attrs || {};
    return (
        attrs.name ||
        attrs.tool ||
        attrs.function ||
        attrs.function_name ||
        attrs.id ||
        "unknown_tool"
    );
};

const getToolPresentation = (toolName = "") => {
    const normalized = String(toolName).toLowerCase();

    if (normalized.includes("wiki")) {
        return {
            icon: FaWikipediaW,
            label: "Wikipedia",
            colorScheme: "blue",
            borderColor: "blue.300",
            bg: "blue.50",
        };
    }

    if (normalized.includes("pubmed")) {
        return {
            icon: FaBookMedical,
            label: "PubMed",
            colorScheme: "teal",
            borderColor: "teal.300",
            bg: "teal.50",
        };
    }

    if (normalized.includes("literature")) {
        return {
            icon: FaSearch,
            label: "Literature",
            colorScheme: "green",
            borderColor: "green.300",
            bg: "green.50",
        };
    }

    if (normalized.includes("transcript")) {
        return {
            icon: FaFileAlt,
            label: "Transcript",
            colorScheme: "orange",
            borderColor: "orange.300",
            bg: "orange.50",
        };
    }

    if (normalized.includes("direct_response")) {
        return {
            icon: FaRegCommentDots,
            label: "Direct response",
            colorScheme: "gray",
            borderColor: "gray.300",
            bg: "gray.50",
        };
    }

    return {
        icon: FaTools,
        label: "Tool",
        colorScheme: "purple",
        borderColor: "purple.300",
        bg: "purple.50",
    };
};

const formatToolContent = (value = "") => {
    const content = String(value ?? "");
    const trimmed = content.trim();

    if (!trimmed) return "";

    try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return content;
    }
};

const ChatMessages = ({
    messages,
    toggleThinkingVisibility,
    getThinkingBlockState,
}) => {
    const [expandedToolBlocks, setExpandedToolBlocks] = useState({});

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
                const blocks =
                    parsed?.blocks && parsed.blocks.length > 0
                        ? parsed.blocks
                        : [{ type: "text", content: message.content || "" }];

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
                                    spacing={0.25}
                                    width="100%"
                                >
                                    {message.role === "assistant" && (
                                        <HStack spacing={1.5} mb={0.5}>
                                            <Image
                                                src="/logo.webp"
                                                alt="Phlox Assistant"
                                                boxSize="14px"
                                                objectFit="contain"
                                            />
                                            <Text
                                                fontSize="xs"
                                                fontWeight="semibold"
                                                color="gray.500"
                                                lineHeight="1"
                                            >
                                                Phlox Assistant
                                            </Text>
                                        </HStack>
                                    )}

                                    {blocks.map((block, blockIndex) => {
                                        if (block.type === "think") {
                                            const isExpanded =
                                                getThinkingBlockState
                                                    ? getThinkingBlockState(
                                                          message,
                                                          blockIndex,
                                                      )
                                                    : Boolean(
                                                          message.isThinkingExpanded,
                                                      );

                                            return (
                                                <Box
                                                    width="100%"
                                                    my={0.5}
                                                    key={`think-${messageIndex}-${blockIndex}`}
                                                >
                                                    <Flex
                                                        align="center"
                                                        onClick={() =>
                                                            toggleThinkingVisibility(
                                                                messageIndex,
                                                                blockIndex,
                                                            )
                                                        }
                                                        cursor="pointer"
                                                        p={1}
                                                        borderRadius="sm"
                                                        className="thinking-toggle"
                                                    >
                                                        <Text
                                                            mr="2"
                                                            fontWeight="medium"
                                                        >
                                                            Thinking
                                                            {block.isPartial
                                                                ? "..."
                                                                : ""}
                                                        </Text>
                                                        <IconButton
                                                            aria-label={
                                                                isExpanded
                                                                    ? "Collapse thinking"
                                                                    : "Expand thinking"
                                                            }
                                                            icon={
                                                                isExpanded ? (
                                                                    <ChevronUpIcon />
                                                                ) : (
                                                                    <ChevronDownIcon />
                                                                )
                                                            }
                                                            variant="ghost"
                                                            size="xs"
                                                            className="chat-disclosure-icon"
                                                        />
                                                    </Flex>
                                                    <Collapse
                                                        in={isExpanded}
                                                        animateOpacity
                                                    >
                                                        <Box
                                                            className="thinking-block"
                                                            mt={2}
                                                            p={2}
                                                            borderLeftWidth="3px"
                                                            borderColor="blue.300"
                                                            bg="blackAlpha.50"
                                                            borderRadius="sm"
                                                        >
                                                            <Text
                                                                whiteSpace="pre-wrap"
                                                                className="thinking-block-text"
                                                            >
                                                                {block.content}
                                                            </Text>
                                                        </Box>
                                                    </Collapse>
                                                </Box>
                                            );
                                        }

                                        if (block.type === "tool") {
                                            const isExpanded = getToolExpanded(
                                                messageIndex,
                                                blockIndex,
                                            );
                                            const toolName = getToolName(block);
                                            const status =
                                                block?.attrs?.status ||
                                                block?.attrs?.state ||
                                                "";
                                            const toolQuery =
                                                block?.attrs?.query || "";
                                            const clinicianActivityText =
                                                String(block?.content || "")
                                                    .replace(/\s+/g, " ")
                                                    .trim();
                                            const headerStatusLabel =
                                                status === "running" ||
                                                block.isPartial
                                                    ? "Running"
                                                    : status
                                                      ? String(status)
                                                      : "";
                                            const toolContent =
                                                formatToolContent(
                                                    block.content,
                                                );
                                            const presentation =
                                                getToolPresentation(toolName);
                                            const ToolIcon = presentation.icon;

                                            return (
                                                <Box
                                                    width="100%"
                                                    my={0.5}
                                                    key={`tool-${messageIndex}-${blockIndex}`}
                                                >
                                                    <Flex
                                                        align="center"
                                                        onClick={() =>
                                                            toggleToolExpanded(
                                                                messageIndex,
                                                                blockIndex,
                                                            )
                                                        }
                                                        cursor="pointer"
                                                        p={0.5}
                                                        borderRadius="sm"
                                                        className="thinking-toggle"
                                                    >
                                                        <HStack
                                                            spacing={1.5}
                                                            mr="1"
                                                        >
                                                            <ToolIcon size="0.75em" />
                                                            <Text
                                                                fontSize="xs"
                                                                fontWeight="semibold"
                                                            >
                                                                {
                                                                    presentation.label
                                                                }
                                                            </Text>
                                                            {headerStatusLabel && (
                                                                <Badge
                                                                    colorScheme={
                                                                        presentation.colorScheme
                                                                    }
                                                                    variant="subtle"
                                                                    fontSize="10px"
                                                                >
                                                                    {
                                                                        headerStatusLabel
                                                                    }
                                                                </Badge>
                                                            )}
                                                        </HStack>
                                                        <IconButton
                                                            aria-label={
                                                                isExpanded
                                                                    ? "Collapse tool output"
                                                                    : "Expand tool output"
                                                            }
                                                            icon={
                                                                isExpanded ? (
                                                                    <ChevronUpIcon />
                                                                ) : (
                                                                    <ChevronDownIcon />
                                                                )
                                                            }
                                                            variant="ghost"
                                                            size="xs"
                                                            className="chat-disclosure-icon"
                                                        />
                                                    </Flex>
                                                    <Collapse
                                                        in={isExpanded}
                                                        animateOpacity
                                                    >
                                                        <Box
                                                            mt={1}
                                                            p={1}
                                                            borderLeftWidth="3px"
                                                            borderColor={
                                                                presentation.borderColor
                                                            }
                                                            bg={presentation.bg}
                                                            borderRadius="sm"
                                                        >
                                                            {toolQuery && (
                                                                <Text
                                                                    fontSize="xs"
                                                                    mb={1}
                                                                    color="gray.700"
                                                                >
                                                                    <strong>
                                                                        Query:
                                                                    </strong>{" "}
                                                                    {toolQuery}
                                                                </Text>
                                                            )}
                                                            {clinicianActivityText && (
                                                                <Text
                                                                    fontSize="xs"
                                                                    mb={1}
                                                                    color="gray.700"
                                                                >
                                                                    {
                                                                        clinicianActivityText
                                                                    }
                                                                </Text>
                                                            )}
                                                            <Text
                                                                whiteSpace="pre-wrap"
                                                                fontFamily="mono"
                                                                fontSize="xs"
                                                            >
                                                                {toolContent ||
                                                                    "(No tool output)"}
                                                            </Text>
                                                        </Box>
                                                    </Collapse>
                                                </Box>
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
                                                <MarkdownRenderer>
                                                    {block.content}
                                                </MarkdownRenderer>
                                            </Box>
                                        );
                                    })}

                                    {message.role === "assistant" &&
                                        message.context && (
                                            <HStack
                                                wrap="wrap"
                                                spacing={1}
                                                mt={1}
                                            >
                                                {Object.entries(
                                                    message.context,
                                                ).map(([key, val]) => (
                                                    <Tooltip
                                                        key={key}
                                                        label={val}
                                                        placement="top"
                                                        hasArrow
                                                        fontSize="xs"
                                                        maxWidth="400px"
                                                        shouldWrapChildren
                                                        bg="gray.700"
                                                        color="white"
                                                    >
                                                        <Text
                                                            as="span"
                                                            color="blue.500"
                                                            cursor="pointer"
                                                            fontSize="xs"
                                                            _hover={{
                                                                textDecoration:
                                                                    "underline",
                                                            }}
                                                        >
                                                            [{key}]
                                                        </Text>
                                                    </Tooltip>
                                                ))}
                                            </HStack>
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
