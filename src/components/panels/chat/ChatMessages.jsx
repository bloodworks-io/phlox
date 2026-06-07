import React, { useMemo, useState } from "react";
import {
    Flex,
    Box,
    Text,
    HStack,
    VStack,
    Spinner,
    Image,
    Button,
    Link,
    useColorMode,
} from "@chakra-ui/react";
import { ExternalLinkIcon, DownloadIcon } from "@chakra-ui/icons";
import {
    FaFilePdf,
    FaFileImage,
    FaFile,
} from "react-icons/fa";
import { parseMessageContent } from "../../../utils/chat/messageParser";
import { groupActivityTrace } from "../../../utils/chat/activityTrace";
import ActivityTraceBlock from "../../common/ActivityTraceBlock";
import MarkdownRenderer from "../../common/MarkdownRenderer";
import { CitationList } from "../reasoning/components/CitationList";

const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getArtifactIcon = (mimeType = "") => {
    if (mimeType.startsWith("image/")) return FaFileImage;
    if (mimeType === "application/pdf") return FaFilePdf;
    return FaFile;
};

const ArtifactCard = ({ artifact }) => {
    const { filename, mime_type, size, url } = artifact;
    const Icon = getArtifactIcon(mime_type);

    return (
        <Box
            p={2}
            borderWidth="1px"
            borderRadius="md"
            borderColor="gray.200"
            bg="gray.50"
            _dark={{ borderColor: "gray.600", bg: "gray.750" }}
            maxW="320px"
        >
            <HStack spacing={2} mb={1}>
                <Icon size="1.2em" color="gray.500" />
                <Text fontSize="xs" fontWeight="semibold" isTruncated flex={1}>
                    {filename}
                </Text>
            </HStack>
            <HStack spacing={2} justify="space-between">
                <Text fontSize="xs" color="gray.500">
                    {mime_type} · {formatFileSize(size)}
                </Text>
                <HStack spacing={1}>
                    {mime_type === "application/pdf" && (
                        <Link href={url} isExternal>
                            <Button
                                size="xs"
                                variant="ghost"
                                colorScheme="blue"
                                leftIcon={<ExternalLinkIcon />}
                                aria-label="View file"
                            >
                                View
                            </Button>
                        </Link>
                    )}
                    <Link href={url} download>
                        <Button
                            size="xs"
                            variant="ghost"
                            colorScheme="blue"
                            leftIcon={<DownloadIcon />}
                            aria-label="Download file"
                        >
                            Save
                        </Button>
                    </Link>
                </HStack>
            </HStack>
        </Box>
    );
};

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
                                                spacing={1}
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
        </>
    );
};

export default ChatMessages;
