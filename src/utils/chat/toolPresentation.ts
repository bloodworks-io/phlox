import {
    LuBookOpen,
    LuBriefcaseMedical,
    LuFileText,
    LuMessageCircle,
    LuSearch,
    LuWrench,
} from "react-icons/lu";

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
            icon: LuBookOpen,
            label: "Wikipedia",
            colorScheme: "blue",
            color: "folio.info",
            borderColor: "folio.info",
            bg: "folio.infoSoft",
        };
    }

    if (normalized.includes("pubmed")) {
        return {
            icon: LuBriefcaseMedical,
            label: "PubMed",
            colorScheme: "teal",
            color: "folio.info",
            borderColor: "folio.info",
            bg: "folio.infoSoft",
        };
    }

    if (normalized.includes("literature")) {
        return {
            icon: LuSearch,
            label: "Literature search",
            colorScheme: "green",
            color: "folio.success",
            borderColor: "folio.success",
            bg: "folio.successSoft",
        };
    }

    if (normalized.includes("transcript")) {
        return {
            icon: LuFileText,
            label: "Transcript",
            colorScheme: "orange",
            color: "folio.warning",
            borderColor: "folio.warning",
            bg: "folio.warningSoft",
        };
    }

    if (normalized.includes("direct_response")) {
        return {
            icon: LuMessageCircle,
            label: "Direct response",
            colorScheme: "gray",
            color: "folio.muted",
            borderColor: "folio.line",
            bg: "folio.paperAlt",
        };
    }

    return {
        icon: LuWrench,
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
