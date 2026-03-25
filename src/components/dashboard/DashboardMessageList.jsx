import React, { useState } from "react";
import {
    Box,
    Flex,
    VStack,
    HStack,
    Text,
    IconButton,
    Tooltip,
    Spinner,
    Collapse,
    Badge,
    Icon,
    Image,
} from "@chakra-ui/react";
import {
    ChevronDownIcon,
    ChevronUpIcon,
    AttachmentIcon,
} from "@chakra-ui/icons";
import {
    FaFilePdf,
    FaFileImage,
    FaTools,
    FaWikipediaW,
    FaBookMedical,
    FaSearch,
    FaFileAlt,
    FaRegCommentDots,
} from "react-icons/fa";
import MarkdownRenderer from "../common/MarkdownRenderer";
import { parseMessageContent } from "../../utils/chat/messageParser";

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
            borderColor: "blue.300",
            bg: "blue.50",
        };
    }

    if (normalized.includes("pubmed")) {
        return {
            icon: FaBookMedical,
            label: "PubMed",
            borderColor: "teal.300",
            bg: "teal.50",
        };
    }

    if (normalized.includes("literature")) {
        return {
            icon: FaSearch,
            label: "Literature",
            borderColor: "green.300",
            bg: "green.50",
        };
    }

    if (normalized.includes("transcript")) {
        return {
            icon: FaFileAlt,
            label: "Transcript",
            borderColor: "orange.300",
            bg: "orange.50",
        };
    }

    if (normalized.includes("direct_response")) {
        return {
            icon: FaRegCommentDots,
            label: "Direct response",
            borderColor: "gray.300",
            bg: "gray.50",
        };
    }

    return {
        icon: FaTools,
        label: "Tool",
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

const DashboardMessageList = ({
    visibleMessages = [],
    setMessages,
    messagesEndRef,
}) => {
    const [showTooltip, setShowTooltip] = useState(null);
    const [expandedToolBlocks, setExpandedToolBlocks] = useState({});

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
                const nextExpanded = !Boolean(currentMap[blockIndex]);

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

    const getToolExpanded = (messageIndex, blockIndex) =>
        Boolean(expandedToolBlocks[`${messageIndex}:${blockIndex}`]);

    const toggleToolExpanded = (messageIndex, blockIndex) => {
        const key = `${messageIndex}:${blockIndex}`;
        setExpandedToolBlocks((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    return (
        <VStack
            spacing={2}
            align="stretch"
            w="100%"
            maxW="800px"
            mx="auto"
            px="20px"
        >
            {visibleMessages.map(({ message, messageIndex }) => {
                const parsed = parseMessageContent(message.content || "");
                const blocks =
                    parsed?.blocks && parsed.blocks.length > 0
                        ? parsed.blocks
                        : [{ type: "text", content: message.content || "" }];

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
                                <VStack align="start" spacing={0.5} width="100%">
                                    {message.role === "assistant" && (
                                        <HStack spacing={2} mb={0.5}>
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
                                            <HStack spacing={1} mb={1} flexWrap="wrap">
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
                                                            colorScheme={
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
                                        if (block.type === "think") {
                                            const isThinkingExpanded =
                                                getThinkingBlockState(
                                                    message,
                                                    blockIndex,
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
                                                        className="thinking-toggle"
                                                        p={0.5}
                                                        borderRadius="sm"
                                                    >
                                                        <Text
                                                            mr="1.5"
                                                            fontSize="xs"
                                                            fontWeight="medium"
                                                        >
                                                            Thinking{" "}
                                                            {block.isPartial ? "..." : ""}
                                                        </Text>
                                                        <IconButton
                                                            aria-label={
                                                                isThinkingExpanded
                                                                    ? "Collapse thinking"
                                                                    : "Expand thinking"
                                                            }
                                                            icon={
                                                                isThinkingExpanded ? (
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
                                                        in={isThinkingExpanded}
                                                        animateOpacity
                                                    >
                                                        <Box
                                                            className="thinking-block"
                                                            mt={1}
                                                            p={1}
                                                            borderLeftWidth="3px"
                                                            borderColor="blue.300"
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
                                            const isToolExpanded =
                                                getToolExpanded(
                                                    messageIndex,
                                                    blockIndex,
                                                );
                                            const toolName = getToolName(block);
                                            const presentation =
                                                getToolPresentation(toolName);
                                            const ToolIcon = presentation.icon;
                                            const toolContent =
                                                formatToolContent(block.content);

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
                                                        className="thinking-toggle"
                                                        p={0.5}
                                                        borderRadius="sm"
                                                    >
                                                        <HStack spacing={1.5} mr="1">
                                                            <ToolIcon size="0.75em" />
                                                            <Text
                                                                fontWeight="bold"
                                                                fontSize="xs"
                                                            >
                                                                {presentation.label}
                                                            </Text>
                                                        </HStack>
                                                        <IconButton
                                                            aria-label={
                                                                isToolExpanded
                                                                    ? "Collapse tool output"
                                                                    : "Expand tool output"
                                                            }
                                                            icon={
                                                                isToolExpanded ? (
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
                                                        in={isToolExpanded}
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
                                                            <Text
                                                                fontSize="xs"
                                                                color="gray.500"
                                                                mb={1}
                                                            >
                                                                {toolContent ||
                                                                    "(No tool output)"}
                                                            </Text>
                                                        </Box>
                                                    </Collapse>
                                                </Box>
                                            );
                                        }

                                        if (!block.content) return null;

                                        return (
                                            <Box
                                                fontSize="sm !important"
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
                                            <HStack wrap="wrap" spacing={1} mt={1}>
                                                {Object.keys(message.context).map((key) => (
                                                    <Tooltip
                                                        key={`context-${messageIndex}-${key}`}
                                                        label={message.context[key]}
                                                        placement="top"
                                                        hasArrow
                                                        fontSize="xs"
                                                        maxWidth="400px"
                                                        shouldWrapChildren
                                                        bg="gray.700"
                                                        color="white"
                                                        isOpen={
                                                            showTooltip ===
                                                            `context-${messageIndex}-${key}`
                                                        }
                                                    >
                                                        <Text
                                                            as="span"
                                                            color="blue.500"
                                                            cursor="pointer"
                                                            fontSize="xs"
                                                            _hover={{
                                                                textDecoration: "underline",
                                                            }}
                                                            onMouseEnter={() =>
                                                                setShowTooltip(
                                                                    `context-${messageIndex}-${key}`,
                                                                )
                                                            }
                                                            onMouseLeave={() =>
                                                                setShowTooltip(null)
                                                            }
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
            <div ref={messagesEndRef} />
        </VStack>
    );
};

export default DashboardMessageList;
