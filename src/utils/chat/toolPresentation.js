import {
    FaTools,
    FaWikipediaW,
    FaBookMedical,
    FaSearch,
    FaFileAlt,
    FaRegCommentDots,
} from "react-icons/fa";

export const getToolName = (toolBlock) => {
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

export const getToolPresentation = (toolName = "") => {
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
            label: "Literature search",
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

export const formatToolContent = (value = "") => {
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
