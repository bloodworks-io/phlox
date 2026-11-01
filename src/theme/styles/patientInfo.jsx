// Styles for the patient information bar component
import { colors } from "../colors";

const patientInfoStyles = (props) => ({
    ".pill-box": {
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.secondary} !important`
                : `${colors.dark.secondary} !important`,
        border: "none",
        padding: "10px 20px",
        borderRadius: "lg",
    },
    ".pill-box-icons": {
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textQuaternary} !important`,
        minWidth: "16px",
        marginRight: "8px",
        flexShrink: 0, // Prevent icon from shrinking
    },

    // Clinical Folio settings metadata/icons. Scoped: `.pill-box-icons`
    // stays legacy for splash/panel/scribe consumers outside Settings.
    // Layout metrics mirror the legacy class to preserve geometry.
    ".settings-meta": {
        color: "folio.muted !important",
        minWidth: "16px",
        marginRight: "8px",
        flexShrink: 0, // Prevent icon from shrinking
    },

    // Clinical Folio consultation surfaces. These are deliberately scoped:
    // `.panels-bg` remains the legacy surface for RAG/settings/PDF consumers.
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

const _lo = patientInfoStyles({ colorMode: "light" });
const _do = patientInfoStyles({ colorMode: "dark" });
export const patientInfoGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    patientInfoGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
