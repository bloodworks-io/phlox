// Styles for the chat interface.
import { colors } from "../colors";

const floatingStyles = (props) => ({
    ".floating-panel": {
        backgroundColor: "folio.paper",
        borderRadius: "folioOverlay",
        border: "1px solid",
        borderColor: "folio.line",
        color: "folio.ink",
        fontWeight: "normal",
        boxShadow: "overlay",
    },
    ".attached-panel-body": {
        backgroundColor: "folio.canvas",
        color: "folio.ink",
        fontWeight: "normal",
        fontSize: "0.7rem",
    },
    // Clinical Folio settings tab body. Scoped: `.floating-main` remains the
    // legacy surface for RAG consumers outside Settings. Preserves the
    // compact 0.7rem density and the tab-flush top-left corner geometry.
    ".settings-tab-body": {
        backgroundColor: "folio.canvas",
        color: "folio.ink !important",
        fontWeight: "normal",
        borderTop: "1px solid !important",
        borderTopColor: "folio.line !important",
        borderTopLeftRadius: "0 !important",
        borderTopRightRadius: "md !important",
        borderBottomLeftRadius: "md !important",
        borderBottomRightRadius: "md !important",
        fontSize: "0.7rem !important",
    },
    // Clinical Folio settings collapse toggle. Scoped: the global
    // `.collapse-toggle` stays legacy for RAG consumers outside Settings.
    ".settings-collapse-toggle": {
        border: "none !important",
        borderRadius: "lg !important",
        color: "folio.muted !important",
        backgroundColor: "folio.paperAlt !important",
    },
    ".attached-chat-input": {
        backgroundColor: "folio.paperAlt",
        borderColor: "folio.line",
        color: "folio.ink",
    },
    ".floating-main": {
        backgroundColor:
            props.colorMode === "light" ? colors.light.base : colors.dark.crust,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
        fontWeight: "normal",

        borderTopLeftRadius: "0 !important",
        borderTopRightRadius: "md !important",
        borderBottomLeftRadius: "md !important",
        borderBottomRightRadius: "md !important",
        fontSize: "0.7rem !important",
    },
    ".chat-suggestions": {
        backgroundColor: "folio.paperAlt",
        borderRadius: "folioControl !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        fontWeight: "500 !important",
        fontSize: "0.9rem !important",
        color: "folio.muted !important",
        transition:
            "color 160ms ease, background-color 160ms ease, border-color 160ms ease",
        _hover: {
            backgroundColor: "folio.hover",
            color: "folio.ink",
            boxShadow: "none",
        },
    },
    ".refinement-suggestions": {
        backgroundColor: "folio.paperAlt",
        borderRadius: "folioControl !important",
        height: "25px !important",
        fontSize: "0.8rem !important",
        fontWeight: "500 !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        color: "folio.muted !important",
        transition:
            "color 160ms ease, background-color 160ms ease, border-color 160ms ease",
        _hover: {
            backgroundColor: "folio.hover",
            color: "folio.ink",
        },
    },
    ".quick-chat-buttons-collapsed": {
        backgroundColor: "folio.paperAlt !important",
        borderRadius: "folioControl !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        color: "folio.muted !important",
        justifyContent: "flex-start !important",
        padding: "0 8px !important",
        height: "32px !important",
        transition:
            "color 160ms ease, background-color 160ms ease, border-color 160ms ease",
        _hover: {
            backgroundColor: "folio.hover !important",
            color: "folio.ink !important",
        },
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
        borderRadius: "folioControl",
        wordBreak: "break-word",
    },
    ".message-box.assistant": {
        backgroundColor: "transparent !important",
        color: "folio.muted !important",
        borderRadius: "0 !important",
        border: "none !important",
        boxShadow: "none !important",
        padding: "0 !important",
    },
    ".message-box.user": {
        backgroundColor: "folio.accentSoft !important",
        color: "folio.ink !important",
        borderRadius: "folioControl !important",
    },
    ".message-box ul, .message-box ol": {
        paddingLeft: "20px",
    },
    ".template-selector": {
        borderTop: "1px solid !important",
        borderTopColor: "folio.line !important",
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
        borderLeftColor: "folio.info !important",
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
        color: "folio.muted !important",
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
    ".pill-box-scribe": {
        backgroundColor: "folio.sidebar",
        color: "folio.sidebarInk",
        border: "1px solid",
        borderColor: "folio.line",
        boxShadow: "overlay",
        justifyContent: "center",
        alignItems: "center",
    },
    // Live scribe: small-caps section labels inside the live window
    ".live-section-label": {
        fontSize: "9px !important",
        fontWeight: "700 !important",
        letterSpacing: "0.9px !important",
        textTransform: "uppercase !important",
        color: "folio.muted !important",
    },
    ".floating-action-menu": {
        backgroundColor: "folio.paper",
        color: "folio.muted",
        border: "1px solid",
        borderColor: "folio.line",
        boxShadow: "overlay",
    },
    ".floating-action-menu .chakra-button svg": {
        width: "14px !important",
        height: "14px !important",
    },
    // Dashboard chat styles
    ".dashboard-chat-container": {
        height: "calc(100dvh - 60px)",
        display: "flex",
        flexDirection: "column",
        width: "100%",
    },
    ".dashboard-chat-input-container": {
        background: "folio.paper !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        borderRadius: "folioOverlay !important",
        color: "folio.ink !important",
        padding: "10px 16px !important",
        transition:
            "background-color 160ms ease, border-color 160ms ease, color 160ms ease",
    },
    ".dashboard-chat-messages": {
        height: "calc(100dvh - 160px)",
        overflowY: "auto",
        paddingBottom: "100px", // Space for fixed input
    },
    ".dashboard-chat-greeting": {
        color: "folio.ink !important",
    },
    ".dashboard-chat-suggestions": {
        backgroundColor: "folio.paper !important",
        borderRadius: "folioControl !important",
        fontWeight: "500 !important",
        fontSize: "0.9rem !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        color: "folio.muted !important",
        transition:
            "background-color 160ms ease, border-color 160ms ease, color 160ms ease",
        _hover: {
            backgroundColor: "folio.hover",
            borderColor: "folio.focus",
            color: "folio.ink",
            boxShadow: "none",
        },
    },
});

const _lo = floatingStyles({ colorMode: "light" });
const _do = floatingStyles({ colorMode: "dark" });
export const floatingGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    floatingGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
