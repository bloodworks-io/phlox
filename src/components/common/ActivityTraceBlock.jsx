import React, { useRef, useState, useEffect } from "react";
import { Steps, Box, Flex, Text, HStack, IconButton, Collapsible, Spinner } from "@chakra-ui/react";
import { ChevronDownIcon, ChevronUpIcon } from "./icons";
import {
    getToolName,
    getToolPresentation,
    formatToolContent,
} from "../../utils/chat/toolPresentation";

const TRACE_EXPANDED_KEY = "__trace__";

/**
 * ActivityTraceBlock — unified collapsed/expanded view for a group of
 * consecutive think + tool blocks.
 *
 * Collapsed: single line showing the current activity label + spinner.
 * Expanded: full trace with each step as its own collapsible section.
 */
const ActivityTraceBlock = ({
    traceBlocks,
    currentActivity,
    messageIndex,
    message,
    getThinkingBlockState,
    toggleThinkingVisibility,
    expandedToolBlocks,
    toggleToolExpanded,
}) => {
    const isTraceExpanded = getThinkingBlockState
        ? Boolean(
              getThinkingBlockState(message, TRACE_EXPANDED_KEY) ||
                  message?.isThinkingExpanded,
          )
        : Boolean(message?.isThinkingExpanded);

    const toggleTraceExpanded = () => {
        if (toggleThinkingVisibility) {
            toggleThinkingVisibility(messageIndex, TRACE_EXPANDED_KEY);
        }
    };

    const stepCount = traceBlocks.length;

    // Timer: track how long thinking/tool use took
    const startedAtRef = useRef(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(null);

    if (startedAtRef.current === null) {
        startedAtRef.current = Date.now();
    }

    useEffect(() => {
        if (!currentActivity.isOngoing && startedAtRef.current) {
            const seconds = Math.round(
                (Date.now() - startedAtRef.current) / 1000,
            );
            setElapsedSeconds(seconds);
        }
    }, [currentActivity.isOngoing]);

    const formatDuration = (secs) => {
        if (secs < 60) return `${secs}s`;
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}m ${s}s`;
    };

    const collapsedLabel = currentActivity.isOngoing
        ? `${currentActivity.label}...`
        : elapsedSeconds !== null
          ? `Thought for ${formatDuration(elapsedSeconds)}`
          : currentActivity.label;

    return (
        <Box width="100%" my={0.5}>
            {/* Header — shows current activity when collapsed, step count when expanded */}
            <Flex
                align="center"
                onClick={toggleTraceExpanded}
                cursor="pointer"
                p={1}
                borderRadius="sm"
                className="thinking-toggle"
            >
                {!isTraceExpanded ? (
                    <>
                        <Text mr="2" fontWeight="medium" fontSize="xs">
                            {collapsedLabel}
                        </Text>
                        {currentActivity.isOngoing && (
                            <Spinner size="xs" mr="2" />
                        )}
                    </>
                ) : (
                    <Text mr="2" fontWeight="medium" fontSize="xs" color="gray.500">
                        {stepCount} {stepCount === 1 ? "step" : "steps"}
                    </Text>
                )}
                <IconButton
                    aria-label={
                        isTraceExpanded ? "Collapse trace" : "Expand trace"
                    }
                    variant="ghost"
                    size="xs"
                    className="chat-disclosure-icon">{isTraceExpanded ? (
                        <ChevronUpIcon />
                    ) : (
                        <ChevronDownIcon />
                    )}</IconButton>
            </Flex>
            {/* Expanded — full trace of all steps */}
            <Collapsible.Root open={isTraceExpanded}>
                <Collapsible.Content>
                    <Box ml={1}>
                        {traceBlocks.map((block, blockIndex) => {
                            if (block.type === "think") {
                                const isExpanded = getThinkingBlockState
                                    ? getThinkingBlockState(message, blockIndex)
                                    : Boolean(message?.isThinkingExpanded);

                                return (
                                    <Box
                                        key={`trace-think-${blockIndex}`}
                                        my={0.5}
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
                                            p={0.5}
                                            borderRadius="sm"
                                            className="thinking-toggle"
                                        >
                                            <Text
                                                mr="1.5"
                                                fontSize="xs"
                                                fontWeight="medium"
                                            >
                                                Thinking
                                                {block.isPartial ? "..." : ""}
                                            </Text>
                                            <IconButton
                                                aria-label={
                                                    isExpanded
                                                        ? "Collapse thinking"
                                                        : "Expand thinking"
                                                }
                                                variant="ghost"
                                                size="xs"
                                                className="chat-disclosure-icon">{isExpanded ? (
                                                    <ChevronUpIcon />
                                                ) : (
                                                    <ChevronDownIcon />
                                                )}</IconButton>
                                        </Flex>
                                        <Collapsible.Root open={isExpanded}>
                                            <Collapsible.Content>
                                                <Box
                                                    className="thinking-block"
                                                    mt={1}
                                                    p={1}
                                                    borderLeftWidth="3px"
                                                    borderColor="blue.300"
                                                    bg="blackAlpha.50"
                                                    borderRadius="sm"
                                                >
                                                    <Text
                                                        whiteSpace="pre-wrap"
                                                        fontSize="xs"
                                                        className="thinking-block-text"
                                                    >
                                                        {block.content}
                                                    </Text>
                                                </Box>
                                            </Collapsible.Content>
                                        </Collapsible.Root>
                                    </Box>
                                );
                            }

                            if (block.type === "tool") {
                                const toolKey = `${messageIndex}:${blockIndex}`;
                                const isExpanded = expandedToolBlocks
                                    ? Boolean(expandedToolBlocks[toolKey])
                                    : false;
                                const toolName = getToolName(block);
                                const presentation =
                                    getToolPresentation(toolName);
                                const ToolIcon = presentation.icon;
                                const toolContent = formatToolContent(
                                    block.content,
                                );

                                return (
                                    <Box
                                        key={`trace-tool-${blockIndex}`}
                                        my={0.5}
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
                                            <HStack gap={1.5} mr="1">
                                                <ToolIcon size="0.75em" />
                                                <Text
                                                    fontSize="xs"
                                                    fontWeight="bold"
                                                >
                                                    {presentation.label}
                                                </Text>
                                            </HStack>
                                            <IconButton
                                                aria-label={
                                                    isExpanded
                                                        ? "Collapse tool output"
                                                        : "Expand tool output"
                                                }
                                                variant="ghost"
                                                size="xs"
                                                className="chat-disclosure-icon">{isExpanded ? (
                                                    <ChevronUpIcon />
                                                ) : (
                                                    <ChevronDownIcon />
                                                )}</IconButton>
                                        </Flex>
                                        <Collapsible.Root open={isExpanded}>
                                            <Collapsible.Content>
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
                                            </Collapsible.Content>
                                        </Collapsible.Root>
                                    </Box>
                                );
                            }

                            return null;
                        })}
                    </Box>
                </Collapsible.Content>
            </Collapsible.Root>
        </Box>
    );
};

export default ActivityTraceBlock;
