// Styles for text input fields and buttons.

const folioFocusRing = {
    "&:focus": {
        outline: "none !important",
        borderColor: "folio.focus !important",
        boxShadow: "0 0 0 1px var(--chakra-colors-folio-focus) !important",
    },
};

const inputStyles = () => ({
    ".textarea-style": {
        backgroundColor: "folio.canvas !important",
        color: "folio.ink !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        resize: "none !important",
        fontSize: "0.9rem !important",
        padding: "8px !important",
        borderRadius: "folioControl !important",
        overflow: "hidden !important",
        whiteSpace: "pre-wrap !important",
        boxShadow: "none !important",
        "&::placeholder": {
            color: "folio.faint",
        },
        ...folioFocusRing,
        minHeight: "auto !important",
    },
    ".letter-editor-textarea": {
        overflow: "auto !important",
    },
    ".chat-input": {
        backgroundColor: "folio.canvas !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        borderRadius: "folioControl !important",
        color: "folio.ink !important",
        "&::placeholder": {
            color: "folio.faint",
        },
        ...folioFocusRing,
    },
    ".clinic-date-input": {
        backgroundColor: "folio.sidebarAlt !important",
        color: "folio.sidebarInk !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        borderRadius: "folioControl !important",
        ...folioFocusRing,
        "&:focus": {
            outline: "none !important",
            borderColor: "folio.brandOnSidebar !important",
            boxShadow:
                "0 0 0 1px var(--chakra-colors-folio-brand-on-sidebar) !important",
        },
    },
    ".template-field-container": {
        backgroundColor: "folio.paperAlt",
        borderRadius: "folioControl",
        padding: "1rem",
        marginBottom: "1rem",
        border: "1px solid",
        borderColor: "folio.line",
    },

    ".template-field-label": {
        color: "folio.ink",
    },
    ".textarea-container": {
        position: "relative",
        width: "100%",
        "&:hover .refinement-fab": {
            opacity: 1,
        },
    },
    ".note-panel": {
        backgroundColor: "folio.paper",
        color: "folio.ink",
        border: "1px solid",
        borderColor: "folio.line",
        borderRadius: "folioPanel",
    },
    ".note-header": {
        borderBottom: "1px solid",
        borderBottomColor: "folio.line",
    },
    ".note-footer": {
        borderTop: "1px solid",
        borderTopColor: "folio.line",
    },
    ".note-fields-container": {
        backgroundColor: "transparent",
        border: "none",
        borderRadius: "0",
        padding: "12px",
        paddingRight: "72px",
        overflow: "hidden",
    },
    ".note-field-label": {
        color: "folio.ink",
        fontWeight: "600",
    },
    ".cohesive-fields-container": {
        backgroundColor: "folio.canvas !important",
        borderRadius: "lg !important",
        border: "none !important",
        padding: "12px !important",
        paddingRight: "72px !important",
        overflow: "hidden !important",
    },
    ".cohesive-field": {
        borderBottom: "none !important",
        marginBottom: "16px !important",
        "&:last-child": {
            marginBottom: "0 !important",
        },
    },
    ".cohesive-field--empty": {
        marginBottom: "20px !important",
    },
    ".cohesive-field-label": {
        fontSize: "1rem !important",
        fontWeight: "500 !important",
        color: "folio.muted !important",
        padding: "0 0 4px 0 !important",
        marginBottom: "4px !important",
    },
    ".cohesive-persistent-marker": {
        marginLeft: "6px !important",
        display: "inline-flex !important",
        alignItems: "center !important",
        verticalAlign: "middle !important",
        color: "folio.faint !important",
        fontSize: "0.7rem !important",
    },
    ".cohesive-agent-edit-marker": {
        marginLeft: "4px !important",
        display: "inline-flex !important",
        alignItems: "center !important",
        verticalAlign: "middle !important",
        background: "none !important",
        border: "none !important",
        padding: "0 !important",
        cursor: "pointer !important",
        color: "folio.warning !important",
        fontSize: "0.7rem !important",
    },
    ".agent-diff": {
        maxHeight: "300px !important",
        overflowY: "auto !important",
        fontSize: "0.85rem !important",
        lineHeight: "1.5 !important",
        borderRadius: "4px !important",
        padding: "6px 0 !important",
    },
    ".agent-diff-line": {
        padding: "0 10px !important",
        whiteSpace: "pre-wrap !important",
        wordBreak: "break-word !important",
    },
    ".agent-diff-line--same": {
        color: "folio.muted !important",
    },
    ".agent-diff-line--add": {
        backgroundColor: "folio.successSoft !important",
        color: "folio.success !important",
    },
    ".agent-diff-line--remove": {
        backgroundColor: "folio.dangerSoft !important",
        color: "folio.danger !important",
        textDecoration: "line-through !important",
    },
    ".cohesive-textarea": {
        backgroundColor: "transparent !important",
        border: "none !important",
        borderRadius: "0 !important",
        padding: "0 !important",
        fontSize: "1rem !important",
        lineHeight: "1.5 !important",
        fontWeight: "400 !important",
        width: "100% !important",
        resize: "none !important",
        "&:focus": {
            outline: "none !important",
            backgroundColor: "transparent !important",
        },
        "&::placeholder": {
            color: "folio.faint",
        },
    },
    ".cohesive-textarea--empty": {
        minHeight: "24px !important",
        "&::placeholder": {
            color: "folio.faint !important",
            opacity: "1 !important",
        },
    },
    ".note-textarea": {
        "&::placeholder": {
            color: "folio.faint",
        },
    },
    ".refinement-fab": {
        borderRadius: "full !important",
        color: "folio.accentInk !important",
        border: "1px solid !important",
        borderColor: "folio.accent !important",
        backgroundColor: "folio.accent !important",
        opacity: 1,
        transition:
            "color 160ms ease, background-color 160ms ease, border-color 160ms ease",
        width: "40px !important",
        height: "40px !important",
        aspectRatio: "1/1",
        "&:hover": {
            backgroundColor: "folio.accent/90 !important",
        },
    },
    ".refinement-submit-button": {
        borderRadius: "folioControl !important",
        color: "folio.accentInk !important",
        backgroundColor: "folio.accent !important",
        border: "1px solid !important",
        borderColor: "folio.accent !important",
        transition:
            "color 160ms ease, background-color 160ms ease, border-color 160ms ease",
        "&:hover": {
            backgroundColor: "folio.accent/90 !important",
        },
    },
    ".reason-button": {
        backgroundColor: "transparent !important",
        color: "folio.muted !important",
        fontSize: "sm !important",
        borderRadius: "folioControl !important",
        borderRightRadius: "none !important",
        height: "30px !important",
        fontWeight: "medium !important",
        transition:
            "color 160ms ease, background-color 160ms ease !important",
        _active: {
            transform: "none !important",
        },
        "&:hover": {
            backgroundColor: "folio.hover !important",
            color: "folio.ink !important",
        },
    },
    ".reason-button-active": {
        backgroundColor: "folio.accentSoft !important",
        color: "folio.accent !important",
    },
    ".reason-button-active-patient-table": {
        backgroundColor: "folio.accentSoft !important",
        color: "folio.accent !important",
    },
    ".transcription-style": {
        backgroundColor: "folio.canvas !important",
        color: "folio.ink !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        fontSize: "0.9rem !important",
        padding: "8px !important",
        borderRadius: "folioControl !important",
        whiteSpace: "pre-wrap !important",
        boxShadow: "none !important",
        "&::placeholder": {
            color: "folio.faint",
        },
        ...folioFocusRing,
        overflowY: "auto !important",
        resize: "none",
        maxHeight: "200px !important",
        lineHeight: "1.6",
    },
    ".scroll-container": {
        marginLeft: "-5px",
        scrollbarWidth: "thin",
        scrollbarColor: "folio.faint folio.paperAlt",
        "&::-webkit-scrollbar": {
            width: "4px",
        },
        "&::-webkit-scrollbar-track": {
            backgroundColor: "folio.paperAlt",
        },
        "&::-webkit-scrollbar-thumb": {
            backgroundColor: "folio.faint",
            borderRadius: "4px",
        },
    },
    ".transcription-view": {
        backgroundColor: "folio.canvas !important",
        color: "folio.ink !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        borderRadius: "folioControl !important",
        resize: "none !important",
        fontSize: "0.9rem !important",
        padding: "8px !important",
        overflow: "auto !important",
        whiteSpace: "pre-wrap !important",
        boxShadow: "none !important",
        "&::placeholder": {
            color: "folio.faint",
        },
        ...folioFocusRing,
        minHeight: "140px !important",
        maxHeight: "200px !important",
    },
});

const _lightOut = inputStyles();
const _darkOut = inputStyles();
export const inputGlobalCss = {};
for (const selector of Object.keys(_lightOut)) {
    inputGlobalCss[selector] = {
        _light: _lightOut[selector],
        _dark: _darkOut[selector],
    };
}
