// Styles for the patient information bar component
const patientInfoStyles = () => ({
    // Shared Folio metadata/icons class (settings, splash, letter panel).
    // Layout metrics mirror the legacy pill metadata class to preserve
    // geometry.
    ".settings-meta": {
        color: "folio.muted !important",
        minWidth: "16px",
        marginRight: "8px",
        flexShrink: 0, // Prevent icon from shrinking
    },

    ".patient-context-bar": {
        backgroundColor: "folio.paper",
        color: "folio.ink",
        border: "1px solid",
        borderColor: "folio.line",
        borderRadius: "folioPanel",
    },
    ".new-note-card": {
        backgroundColor: "folio.paper",
        color: "folio.ink",
        border: "1px solid",
        borderColor: "folio.line",
        borderRadius: "folioOverlay",
    },
    ".entry-path": {
        backgroundColor: "folio.paperAlt",
        color: "folio.ink",
        border: "1px solid",
        borderColor: "folio.line",
        borderRadius: "folioPanel",
    },
    ".entry-candidate-row": {
        backgroundColor: "folio.paperAlt",
        color: "folio.ink",
        border: "1px solid",
        borderColor: "folio.line",
        borderRadius: "folioControl",
    },

    // Shared Folio input surface. Height, padding, and font metrics are
    // preserved; disabled/error semantics still come from the Folio input
    // recipe layered underneath.
    ".input-style": {
        backgroundColor: "folio.canvas !important",
        color: "folio.ink !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        padding: "7px 8px !important",
        borderRadius: "folioControl !important",
        height: "35px !important",
        fontSize: "0.9rem !important",
        fontWeight: "400 !important",
        "&::placeholder": {
            color: "folio.faint",
        },
        "&:focus": {
            borderColor: "folio.focus !important",
            boxShadow: "0 0 0 1px var(--chakra-colors-folio-focus) !important",
        },
    },
    // Shared Folio file input surface for raw <input type="file"> controls
    // (PDF template upload/replace). Keeps native picker behavior and the
    // previous full-width 0.875rem metrics.
    ".file-input-style": {
        display: "block",
        width: "100%",
        fontSize: "0.875rem",
        color: "folio.ink",
        backgroundColor: "folio.canvas",
        border: "1px solid",
        borderColor: "folio.line",
        borderRadius: "folioControl",
        padding: "6px",
        "&::file-selector-button": {
            color: "folio.muted",
            backgroundColor: "folio.paperAlt",
            border: "1px solid",
            borderColor: "folio.line",
            borderRadius: "folioControl",
            marginRight: "8px",
        },
    },
    ".input-style.quick-chat-title-input": {
        paddingLeft: "32px !important",
        borderRadius: "folioControl !important",
    },
    ".search-button": {
        borderLeft: "none !important",
        borderTopLeftRadius: "0 !important",
        borderBottomLeftRadius: "0 !important",
        borderTopRightRadius: "folioControl !important",
        borderBottomRightRadius: "folioControl !important",
        marginLeft: "-1px",
        backgroundColor: "folio.paperAlt !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        color: "folio.muted !important",
        height: "32px !important",
        minWidth: "32px !important",
        flexShrink: 0, // Prevent button from shrinking
    },
    ".search-button:hover": {
        backgroundColor: "folio.hover !important",
        color: "folio.ink !important",
    },
});

const _lo = patientInfoStyles();
const _do = patientInfoStyles();
export const patientInfoGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    patientInfoGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
