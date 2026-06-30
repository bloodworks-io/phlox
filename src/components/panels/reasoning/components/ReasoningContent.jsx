import React, { useState } from "react";
import {
    Text,
    Tabs,
    VStack,
    Box,
    Badge,
    Button,
} from "@chakra-ui/react";
import { ReasoningItem } from "./ReasoningItem";
import { CitationList } from "./CitationList";

const getReasoningKey = (section) => {
    if (section === "considerations") {
        return "clinical_considerations";
    }
    return section;
};

const renderItems = (section, reasoning, colorMode) => {
    const key = getReasoningKey(section);
    const items = reasoning?.[key];

    if (!items || items.length === 0) {
        return (
            <Text fontSize="sm" color="gray.500">
                No items available
            </Text>
        );
    }

    return (
        <VStack align="stretch" gap={2}>
            {items.map((item, i) => (
                <ReasoningItem
                    key={i}
                    item={item}
                    section={section}
                    colorMode={colorMode}
                />
            ))}
        </VStack>
    );
};

const parseThinkingTrace = (thinking = "") => {
    if (!thinking || typeof thinking !== "string") return [];

    const parts = thinking
        .split(
            /\n(?=Iteration \d+:|Tool call:|Tool result:|Pre-tool reasoning:|Pre-tool assistant note:|Final non-tool reasoning:)/g,
        )
        .map((p) => p.trim())
        .filter(Boolean);

    if (parts.length <= 1) {
        return [{ type: "note", title: "Thinking", content: thinking.trim() }];
    }

    return parts.map((part, index) => {
        if (part.startsWith("Iteration ")) {
            return { type: "iteration", title: "Iteration", content: part };
        }
        if (part.startsWith("Tool call:")) {
            return {
                type: "tool_call",
                title: "Tool Call",
                content: part.replace("Tool call:", "").trim(),
            };
        }
        if (part.startsWith("Tool result:")) {
            return {
                type: "tool_result",
                title: "Tool Result",
                content: part.replace("Tool result:", "").trim(),
            };
        }
        if (part.startsWith("Pre-tool reasoning:")) {
            return {
                type: "reasoning_snapshot",
                title: "Pre-Tool Reasoning",
                content: part.replace("Pre-tool reasoning:", "").trim(),
            };
        }
        if (part.startsWith("Pre-tool assistant note:")) {
            return {
                type: "reasoning_snapshot",
                title: "Pre-Tool Reasoning",
                content: part.replace("Pre-tool assistant note:", "").trim(),
            };
        }
        if (part.startsWith("Final non-tool reasoning:")) {
            return {
                type: "final_reasoning",
                title: "Final Reasoning",
                content: part.replace("Final non-tool reasoning:", "").trim(),
            };
        }
        return { type: "note", title: `Step ${index + 1}`, content: part };
    });
};

const getCardAccent = (type) => {
    switch (type) {
        case "iteration":
            return "purple.400";
        case "tool_call":
            return "orange.400";
        case "tool_result":
            return "blue.400";
        case "reasoning_snapshot":
            return "teal.400";
        case "final_reasoning":
            return "green.400";
        default:
            return "gray.400";
    }
};

const getCardBadge = (type) => {
    switch (type) {
        case "iteration":
            return "Iteration";
        case "tool_call":
            return "Tool";
        case "tool_result":
            return "Result";
        case "reasoning_snapshot":
            return "Reasoning";
        case "final_reasoning":
            return "Reasoning";
        default:
            return "Note";
    }
};

const truncateText = (text, maxChars) => {
    if (!text || text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}...`;
};

const ThinkingCard = ({ step, index, colorMode }) => {
    const isResultCard = step.type === "tool_result";
    const [isResultCollapsed, setIsResultCollapsed] = useState(isResultCard);

    const SHORT_PREVIEW_CHARS = 280;

    let displayedContent = step.content || "";

    if (isResultCard && isResultCollapsed) {
        displayedContent = truncateText(step.content, SHORT_PREVIEW_CHARS);
    }

    return (
        <Box
            key={`${step.type}-${index}`}
            p={3}
            borderWidth="1px"
            borderRadius="md"
            borderLeftWidth="4px"
            borderLeftColor={getCardAccent(step.type)}
            bg={colorMode === "dark" ? "whiteAlpha.100" : "gray.50"}
        >
            <Badge mb={2} colorPalette="gray" variant="subtle">
                {getCardBadge(step.type)}
            </Badge>
            <Text fontSize="sm" whiteSpace="pre-wrap">
                {displayedContent}
            </Text>
            {isResultCard && (
                <Button
                    mt={3}
                    size="xs"
                    variant="outline"
                    onClick={() => setIsResultCollapsed((prev) => !prev)}
                >
                    {isResultCollapsed ? "Expand result" : "Collapse result"}
                </Button>
            )}
        </Box>
    );
};

const renderThinkingCards = (thinking, colorMode) => {
    const steps = parseThinkingTrace(thinking);

    if (!steps.length) {
        return (
            <Text fontSize="sm" color="gray.500">
                No thinking trace available
            </Text>
        );
    }

    return (
        <VStack align="stretch" gap={3}>
            {steps.map((step, i) => (
                <ThinkingCard
                    key={`${step.type}-${i}`}
                    step={step}
                    index={i}
                    colorMode={colorMode}
                />
            ))}
        </VStack>
    );
};

export const ReasoningContent = ({
    reasoning,
    tabIndex,
    setTabIndex,
    colorMode,
}) => {
    return (
        <Tabs.Root
            variant='enclosed'
            value={tabIndex}
            onValueChange={({ value }) => setTabIndex(value)}
            display="flex"
            flexDirection="column"
            height="100%"
        >
            <Tabs.List>
                <Tabs.Trigger className="tab-style" value="0">Summary</Tabs.Trigger>
                <Tabs.Trigger className="tab-style" value="1">Differentials</Tabs.Trigger>
                <Tabs.Trigger className="tab-style" value="2">Investigations</Tabs.Trigger>
                <Tabs.Trigger className="tab-style" value="3">Considerations</Tabs.Trigger>
                <Tabs.Trigger className="tab-style" value="4">Thinking</Tabs.Trigger>
            </Tabs.List>
            {/* Summary Tab */}
            <Tabs.Content className="floating-main" flex="1" minHeight="0" overflowY="auto" display="flex" flexDirection="column" value="0">
                <Text fontSize="sm">{reasoning.summary}</Text>
            </Tabs.Content>

            {/* Differentials Tab */}
            <Tabs.Content className="floating-main" flex="1" minHeight="0" overflowY="auto" value="1">
                {renderItems("differentials", reasoning, colorMode)}
            </Tabs.Content>

            {/* Investigations Tab */}
            <Tabs.Content className="floating-main" flex="1" minHeight="0" overflowY="auto" value="2">
                {renderItems("investigations", reasoning, colorMode)}
            </Tabs.Content>

            {/* Considerations Tab */}
            <Tabs.Content className="floating-main" flex="1" minHeight="0" overflowY="auto" value="3">
                {renderItems("considerations", reasoning, colorMode)}
            </Tabs.Content>

            {/* Thinking Tab */}
            <Tabs.Content className="floating-main" flex="1" minHeight="0" overflowY="auto" value="4">
                {renderThinkingCards(reasoning?.thinking, colorMode)}
                <CitationList
                    citations={reasoning?.citations}
                    colorMode={colorMode}
                />
            </Tabs.Content>
        </Tabs.Root>
    );
};
