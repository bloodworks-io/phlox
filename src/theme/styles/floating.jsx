// Styles for the chat interface.
import { MinusIcon } from "@chakra-ui/icons";
import { colors } from "../colors";
import { WiDayThunderstorm } from "react-icons/wi";

const CHAT_UI_TOKENS = {
    chevron: {
        light: "#9ca3af",
        dark: "#9ca3af",
    },
    userBubble: {
        light: {
            gradient:
                "linear-gradient(180deg, rgba(247, 147, 30, 0.88), rgba(230, 95, 35, 0.82)) !important",
            border: "1px solid rgba(255, 255, 255, 0.32) !important",
            shadow: "0 6px 18px rgba(230, 95, 35, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.28) !important",
        },
        dark: {
            gradient:
                "linear-gradient(180deg, rgba(247, 147, 30, 0.34), rgba(230, 95, 35, 0.26)) !important",
            border: "1px solid rgba(255, 167, 102, 0.28) !important",
            shadow: "0 6px 20px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important",
        },
    },
};

export const floatingStyles = (props) => ({
    ".chat-icon": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.chatIcon} !important`
                : `${colors.dark.chatIcon} !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.invertedText} !important`
                : `${colors.dark.invertedText} !important`,
    },
    ".floating-panel": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.secondary} !important`
                : `${colors.dark.secondary} !important`,
        borderRadius: "xl",
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `1px solid ${colors.dark.surface} !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
        fontSize: "1rem !important",
        fontWeight: "700",
    },
    ".floating-main": {
        backgroundColor:
            props.colorMode === "light" ? colors.light.base : colors.dark.crust,
        borderRight:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `1px solid ${colors.dark.surface} !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
        fontWeight: "normal",
        borderRadius: "none !important",
        fontSize: "0.7rem !important",
    },
    ".chat-suggestions": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.crust} !important`
                : `${colors.dark.overlay0} !important`,
        borderRadius: "xl !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : "none !important",
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textTertiary} !important`,
    },
    ".quick-chat-buttons-collapsed": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.crust} !important`
                : `${colors.dark.overlay0} !important`,
        borderRadius: "lg !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : "none !important",
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textTertiary} !important`,
        justifyContent: "flex-start !important",
        padding: "0 8px !important",
        height: "32px !important",
    },

    ".quick-chat-buttons-text": {
        maxWidth: "calc(100% - 24px) !important",
        whiteSpace: "nowrap !important",
        overflow: "hidden !important",
        textOverflow: "ellipsis !important",
        textAlign: "left !important",
        display: "block !important",
    },
    ".message-box": {
        padding: "10px",
        borderRadius: "2xl",
        wordBreak: "break-word",
    },
    ".message-box.assistant": {
        backgroundColor: "transparent !important",
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
        borderRadius: "0 !important",
        border: "none !important",
        boxShadow: "none !important",
        padding: "0 !important",
    },
    ".message-box.user": {
        background:
            props.colorMode === "light"
                ? CHAT_UI_TOKENS.userBubble.light.gradient
                : CHAT_UI_TOKENS.userBubble.dark.gradient,
        color: colors.light.invertedText,
        borderRadius: "2xl !important",
        backdropFilter: "blur(10px) saturate(140%)",
        border:
            props.colorMode === "light"
                ? CHAT_UI_TOKENS.userBubble.light.border
                : CHAT_UI_TOKENS.userBubble.dark.border,
        boxShadow:
            props.colorMode === "light"
                ? CHAT_UI_TOKENS.userBubble.light.shadow
                : CHAT_UI_TOKENS.userBubble.dark.shadow,
    },
    ".message-box ul, .message-box ol": {
        paddingLeft: "20px",
    },
    ".template-selector": {
        borderTop:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `1px solid ${colors.dark.surface} !important`,
    },
    ".template-selector .template-selector": {
        textAlign: "left !important",
        display: "block !important",
    },
    ".thinking-toggle": {
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 6px",
        margin: "2px 0",
        cursor: "pointer",
        userSelect: "none",
    },
    ".thinking-block": {
        borderLeftColor:
            props.colorMode === "light"
                ? `${colors.light.secondaryButton} !important`
                : `${colors.light.secondaryButton} !important`,
    },
    ".thinking-block-text": {
        fontSize: "0.9rem !important",
    },
    ".collapse-toggle": {
        border: "none !important",
        borderRadius: "lg !important",
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textTertiary} !important`,
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.crust} !important`
                : `${colors.dark.base} !important`,
    },
    ".chat-disclosure-icon": {
        color:
            props.colorMode === "light"
                ? `${CHAT_UI_TOKENS.chevron.light} !important`
                : `${CHAT_UI_TOKENS.chevron.dark} !important`,
        backgroundColor: "transparent !important",
        border: "none !important",
        boxShadow: "none !important",
        minWidth: "auto !important",
        height: "auto !important",
        padding: "0 !important",
    },
    ".chat-disclosure-icon:hover, .chat-disclosure-icon:active": {
        backgroundColor: "transparent !important",
    },
    ".fam-main-button": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface} !important` // Choose a prominent color
                : `${colors.dark.surface} !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.textTertiary} !important`
                : `${colors.dark.textTertiary} !important`,
        transition:
            "transform 0.2s ease-in-out, background-color 0.2s ease-in-out",
        _hover: {
            transform: "scale(1.1)",
            backgroundColor:
                props.colorMode === "light"
                    ? `${colors.light.primaryHover} !important` // Darker/lighter shade
                    : `${colors.dark.primaryHover} !important`,
        },
    },
    ".fam-action-button": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface} !important`
                : `${colors.dark.surface} !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.textTertiary} !important`
                : `${colors.dark.textTertiary} !important`,

        transition:
            "transform 0.15s ease-in-out, background-color 0.15s ease-in-out",
        _hover: {
            transform: "scale(1.05)",
            backgroundColor:
                props.colorMode === "light"
                    ? `${colors.light.overlay0} !important`
                    : `${colors.dark.overlay0} !important`,
        },
    },
    ".pill-box-scribe": {
        background:
            "linear-gradient(to bottom, rgba(45, 47, 65, 0.95), rgba(30, 32, 48, 0.95)) !important",
        backdropFilter: "blur(20px) saturate(180%)",
        color: colors.light.sidebar.text,
        border: "1px solid rgba(0, 0, 0, 0.2) !important",
        boxShadow:
            "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important",
        justifyContent: "center",
        alignItems: "center",
    },
    ".floating-action-menu": {
        backgroundColor:
            props.colorMode === "light"
                ? colors.light.secondary
                : colors.dark.secondary,
        color: colors.light.sidebar.text,
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `1px solid ${colors.dark.surface} !important`,
    },
    // Dashboard chat styles
    ".dashboard-chat-container": {
        height: "calc(100vh - 60px)",
        display: "flex",
        flexDirection: "column",
        width: "100%",
    },
    ".dashboard-chat-input-container": {
        background:
            props.colorMode === "light"
                ? `linear-gradient(to bottom, ${colors.light.secondary}ee, ${colors.light.surface}ee) !important`
                : "linear-gradient(to bottom, rgba(45, 47, 65, 0.95), rgba(38, 40, 56, 0.95)) !important",
        backdropFilter: "blur(20px) saturate(180%)",
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface2} !important`
                : "1px solid rgba(0, 0, 0, 0.2) !important",
        boxShadow:
            props.colorMode === "light"
                ? `0 8px 32px rgba(76, 79, 105, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5) !important`
                : "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important",
        borderRadius: "full !important",
        padding: "10px 16px !important",
        transition: "all 0.3s ease",
    },
    ".dashboard-chat-messages": {
        height: "calc(100vh - 160px)",
        overflowY: "auto",
        paddingBottom: "100px", // Space for fixed input
    },
    ".dashboard-chat-greeting": {
        color:
            props.colorMode === "light"
                ? `${colors.light.textPrimary} !important`
                : `${colors.dark.textPrimary} !important`,
    },
    ".dashboard-chat-suggestions": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.crust} !important`
                : `${colors.dark.overlay0} !important`,
        borderRadius: "xl !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : "none !important",
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textTertiary} !important`,
    },
});
