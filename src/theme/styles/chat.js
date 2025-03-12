// Styles for the chat interface.
import { colors } from "../colors";

export const chatStyles = (props) => ({
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
    ".chat-panel": {
        backgroundColor:
            props.colorMode === "light"
                ? colors.light.secondary
                : colors.dark.secondary,
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
    ".chat-main": {
        backgroundColor:
            props.colorMode === "light" ? colors.light.base : colors.dark.crust,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
        fontWeight: "normal",
    },
    ".chat-suggestions": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.crust} !important`
                : `${colors.dark.overlay0} !important`,
        borderRadius: "sm !important",
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
        borderRadius: "sm !important",
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
        borderRadius: "8px",
        wordBreak: "break-word",
    },
    ".message-box.assistant": {
        backgroundColor: colors.light.surface,
        color: colors.light.textTertiary,
        borderRadius: "sm !important",
    },
    ".message-box.user": {
        backgroundColor: colors.light.chatIcon,
        color: colors.light.invertedText,
    },
    ".message-box ul, .message-box ol": {
        paddingLeft: "20px",
    },
});
