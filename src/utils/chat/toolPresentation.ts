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
            color: "folio.info",
            borderColor: "folio.info",
            bg: "folio.infoSoft",
        };
    }

    if (normalized.includes("pubmed")) {
        return {
            icon: FaBookMedical,
            label: "PubMed",
            colorScheme: "teal",
            color: "folio.info",
            borderColor: "folio.info",
            bg: "folio.infoSoft",
        };
    }

    if (normalized.includes("literature")) {
        return {
            icon: FaSearch,
            label: "Literature search",
            colorScheme: "green",
            color: "folio.success",
            borderColor: "folio.success",
            bg: "folio.successSoft",
        };
    }

    if (normalized.includes("transcript")) {
        return {
            icon: FaFileAlt,
            label: "Transcript",
            colorScheme: "orange",
            color: "folio.warning",
            borderColor: "folio.warning",
            bg: "folio.warningSoft",
        };
    }

    if (normalized.includes("direct_response")) {
        return {
            icon: FaRegCommentDots,
            label: "Direct response",
            colorScheme: "gray",
            color: "folio.muted",
            borderColor: "folio.line",
            bg: "folio.paperAlt",
        };
    }

    return {
        icon: FaTools,
        label: "Tool",
        colorScheme: "purple",
        color: "folio.accent",
        borderColor: "folio.accent",
        bg: "folio.accentSoft",
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
