import React, { useState, useEffect, useRef } from "react";
import {
    Box,
    Flex,
    VStack,
    HStack,
    Text,
    IconButton,
    Tooltip,
    Spinner,
    Button,
    Collapse,
    Badge,
    Icon,
    Image,
} from "@chakra-ui/react";
import {
    ChevronDownIcon,
    ChevronUpIcon,
    InfoIcon,
    SearchIcon,
    QuestionIcon,
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
import { useChat } from "../../utils/hooks/useChat";
import DashboardChatInput from "./DashboardChatInput";
import MarkdownRenderer from "../common/MarkdownRenderer";
import { universalFetch } from "../../utils/helpers/apiHelpers";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { parseMessageContent } from "../../utils/chat/messageParser";
import { chatApi } from "../../utils/api/chatApi";

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

const DashboardChat = () => {
    const {
        messages,
        setMessages,
        userInput,
        setUserInput,
        showSuggestions,
        setShowSuggestions,
        loading: chatLoading,
        sendMessage,
    } = useChat({ mode: "rag" });

    const messagesEndRef = useRef(null);
    const [showTooltip, setShowTooltip] = useState(null);
    const [ragSuggestions, setRagSuggestions] = useState([]);
    const [pendingImage, setPendingImage] = useState(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [expandedToolBlocks, setExpandedToolBlocks] = useState({});

    // Filter out system messages for rendering while preserving original index
    const visibleMessages = messages
        .map((message, messageIndex) => ({ message, messageIndex }))
        .filter(({ message }) => message.role !== "system");

    // Determine if chat has started
    const hasMessages = visibleMessages.length > 0;

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current && hasMessages) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, hasMessages]);

    // Fetch suggestions on mount
    useEffect(() => {
        const fetchSuggestions = async () => {
            try {
                const settingsResponse = await universalFetch(
                    await buildApiUrl("/api/config/user"),
                );
                const userSettings = await settingsResponse.json();
                if (userSettings.specialty) {
                    const response = await universalFetch(
                        await buildApiUrl(`/api/rag/suggestions`),
                    );
                    if (!response.ok)
                        throw new Error("Failed to fetch suggestions");
                    const data = await response.json();
                    setRagSuggestions(data.suggestions);
                }
            } catch (error) {
                console.error("Error fetching RAG suggestions:", error);
            }
        };
        fetchSuggestions();
    }, []);

    const getThinkingBlockState = (message, blockIndex = 0) => {
        if (!message) return false;
        const expandedMap = message.thinkingExpandedBlocks || {};
        return Boolean(expandedMap[blockIndex]);
    };

    const toggleThinkingVisibility = (messageIndex, blockIndex = 0) => {
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

    const handleImageSelect = (file) => {
        setPendingImage(file);
    };

    const handleImageRemove = () => {
        setPendingImage(null);
    };

    const handleSendMessage = (message) => {
        sendMessage(message || userInput);
        setShowSuggestions(false);
    };

    const handleUserInputSend = async () => {
        const hasText = userInput.trim();
        const hasImage = pendingImage;

        if (!hasText && !hasImage) return;

        // If there's an image, process it first
        if (hasImage) {
            setIsProcessingImage(true);
            try {
                const result = await chatApi.uploadImage(pendingImage);
                const extractedText = result.text || "";
                const filename = result.filename || "uploaded file";

                // Build attachment object for UI display
                const attachment = {
                    filename: filename,
                    type: result.content_type,
                    extractedText: extractedText,
                };

                // Clear the pending image and input
                setPendingImage(null);
                const messageText = userInput.trim();
                setUserInput("");
                setIsProcessingImage(false);

                // Send message with attachment (extracted text handled by useChat)
                sendMessage(messageText, null, null, null, [attachment]);
            } catch (error) {
                console.error("Error processing image:", error);
                setIsProcessingImage(false);
                // Still send the text message if there is one
                if (hasText) {
                    sendMessage(userInput);
                    setUserInput("");
                    setPendingImage(null);
                }
            }
        } else {
            // Just text, send normally
            handleSendMessage(userInput);
            setUserInput("");
        }
    };

    // Empty state - centered input
    if (!hasMessages) {
        return (
            <Flex
                className="dashboard-chat-container"
                direction="column"
                align="center"
                justify="center"
                px="20px"
            >
                <VStack spacing={8} w="100%" maxW="800px">
                    {/* Greeting */}
                    <VStack spacing={2}>
                        <Text
                            fontSize="2xl"
                            fontWeight="bold"
                            className="dashboard-chat-greeting"
                        >
                            How can I help you today?
                        </Text>
                        <Text fontSize="md" color="gray.500">
                            Ask about patients, evidence, or outstanding jobs
                        </Text>
                    </VStack>

                    {/* Suggestions */}
                    {showSuggestions && ragSuggestions.length > 0 && (
                        <Flex wrap="wrap" justify="center" gap={3}>
                            {ragSuggestions.map((suggestion, index) => (
                                <Button
                                    key={index}
                                    leftIcon={
                                        index === 0 ? (
                                            <InfoIcon />
                                        ) : index === 1 ? (
                                            <SearchIcon />
                                        ) : (
                                            <QuestionIcon />
                                        )
                                    }
                                    onClick={() =>
                                        handleSendMessage(suggestion)
                                    }
                                    className="dashboard-chat-suggestions"
                                    size="sm"
                                >
                                    {suggestion}
                                </Button>
                            ))}
                        </Flex>
                    )}

                    {/* Centered Input */}
                    <DashboardChatInput
                        value={userInput}
                        onChange={(e) => {
                            setUserInput(e.target.value);
                            if (showSuggestions) setShowSuggestions(false);
                        }}
                        onSend={handleUserInputSend}
                        isLoading={chatLoading}
                        position="centered"
                        pendingImage={pendingImage}
                        onImageSelect={handleImageSelect}
                        onImageRemove={handleImageRemove}
                        isProcessingImage={isProcessingImage}
                    />
                </VStack>
            </Flex>
        );
    }

    // Active chat state - messages at top, input at bottom
    return (
        <Box className="dashboard-chat-container">
            {/* Messages Area */}
            <Box
                className="dashboard-chat-messages"
                position="fixed"
                top="80px"
                left="0"
                right="0"
                bottom="110px"
                w="100%"
                px="0"
            >
                <VStack
                    spacing={2}
                    align="stretch"
                    w="100%"
                    maxW="800px"
                    mx="auto"
                    px="20px"
                >
                    {visibleMessages.map(({ message, messageIndex }) => {
                        const parsed = parseMessageContent(
                            message.content || "",
                        );
                        const blocks =
                            parsed?.blocks && parsed.blocks.length > 0
                                ? parsed.blocks
                                : [
                                      {
                                          type: "text",
                                          content: message.content || "",
                                      },
                                  ];

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
                                    maxWidth={
                                        message.role === "assistant"
                                            ? "92%"
                                            : "80%"
                                    }
                                    px={message.role === "assistant" ? 0 : 3}
                                    py={message.role === "assistant" ? 0 : 2}
                                    bg={
                                        message.role === "assistant"
                                            ? "transparent"
                                            : undefined
                                    }
                                    borderWidth={
                                        message.role === "assistant"
                                            ? "0"
                                            : undefined
                                    }
                                    boxShadow={
                                        message.role === "assistant"
                                            ? "none"
                                            : undefined
                                    }
                                    position="relative"
                                >
                                    {message.loading ? (
                                        <Spinner size="sm" />
                                    ) : (
                                        <VStack
                                            align="start"
                                            spacing={0.5}
                                            width="100%"
                                        >
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

                                            {/* Attachment chips for user messages */}
                                            {message.role === "user" &&
                                                message.attachments?.length >
                                                    0 && (
                                                    <HStack
                                                        spacing={1}
                                                        mb={1}
                                                        flexWrap="wrap"
                                                    >
                                                        {message.attachments.map(
                                                            (att, i) => {
                                                                const isPdf =
                                                                    att.type ===
                                                                    "application/pdf";
                                                                const isImage =
                                                                    att.type?.startsWith(
                                                                        "image/",
                                                                    );
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
                                                                            mr={
                                                                                1
                                                                            }
                                                                        />
                                                                        {
                                                                            att.filename
                                                                        }
                                                                    </Badge>
                                                                );
                                                            },
                                                        )}
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
                                                                    {block.isPartial
                                                                        ? "..."
                                                                        : ""}
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
                                                                in={
                                                                    isThinkingExpanded
                                                                }
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
                                                                        {
                                                                            block.content
                                                                        }
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
                                                    const toolName =
                                                        getToolName(block);
                                                    const status =
                                                        block?.attrs?.status ||
                                                        block?.attrs?.state ||
                                                        "";
                                                    const toolQuery =
                                                        block?.attrs?.query ||
                                                        "";
                                                    const activityText = String(
                                                        block?.content ||
                                                            status ||
                                                            "",
                                                    )
                                                        .replace(/\s+/g, " ")
                                                        .replace(/[:.]+$/, "")
                                                        .trim();
                                                    const presentation =
                                                        getToolPresentation(
                                                            toolName,
                                                        );
                                                    const ToolIcon =
                                                        presentation.icon;
                                                    const toolContent =
                                                        formatToolContent(
                                                            block.content,
                                                        );

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
                                                                <HStack
                                                                    spacing={
                                                                        1.5
                                                                    }
                                                                    mr="1"
                                                                >
                                                                    <ToolIcon size="0.72em" />
                                                                    <Text
                                                                        fontWeight="medium"
                                                                        fontSize="xs"
                                                                    >
                                                                        {
                                                                            presentation.label
                                                                        }
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
                                                                in={
                                                                    isToolExpanded
                                                                }
                                                                animateOpacity
                                                            >
                                                                <Box
                                                                    mt={1}
                                                                    p={1.5}
                                                                    borderLeftWidth="3px"
                                                                    borderColor={
                                                                        presentation.borderColor
                                                                    }
                                                                    bg={
                                                                        presentation.bg
                                                                    }
                                                                    borderRadius="sm"
                                                                >
                                                                    {activityText && (
                                                                        <Text
                                                                            whiteSpace="pre-wrap"
                                                                            fontSize="xs"
                                                                            color="gray.700"
                                                                            mb={
                                                                                1
                                                                            }
                                                                        >
                                                                            {
                                                                                activityText
                                                                            }
                                                                        </Text>
                                                                    )}
                                                                    {toolQuery && (
                                                                        <Text
                                                                            whiteSpace="pre-wrap"
                                                                            fontSize="xs"
                                                                            color="gray.600"
                                                                            mb={
                                                                                1
                                                                            }
                                                                        >
                                                                            Query:{" "}
                                                                            {
                                                                                toolQuery
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

                                            {/* Context citations */}
                                            {message.role === "assistant" &&
                                                message.context && (
                                                    <HStack
                                                        wrap="wrap"
                                                        spacing={1}
                                                        mt={1}
                                                    >
                                                        {Object.keys(
                                                            message.context,
                                                        ).map((key) => (
                                                            <Tooltip
                                                                key={`context-${messageIndex}-${key}`}
                                                                label={
                                                                    message
                                                                        .context[
                                                                        key
                                                                    ]
                                                                }
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
                                                                        textDecoration:
                                                                            "underline",
                                                                    }}
                                                                    onMouseEnter={() =>
                                                                        setShowTooltip(
                                                                            `context-${messageIndex}-${key}`,
                                                                        )
                                                                    }
                                                                    onMouseLeave={() =>
                                                                        setShowTooltip(
                                                                            null,
                                                                        )
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
            </Box>

            {/* Fixed Bottom Input */}
            <DashboardChatInput
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onSend={handleUserInputSend}
                isLoading={chatLoading}
                position="bottom"
                showDisclaimer={true}
                pendingImage={pendingImage}
                onImageSelect={handleImageSelect}
                onImageRemove={handleImageRemove}
                isProcessingImage={isProcessingImage}
            />
        </Box>
    );
};

export default DashboardChat;
