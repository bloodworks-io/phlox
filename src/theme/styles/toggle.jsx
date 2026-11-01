// Defines visual styles for toggle buttons and switches.
import { colors } from "../colors";

const toggleStyles = (props) => ({
    // Scribe transcript mode control — scribe visuals convert in a later
    // Folio slice, so this keeps its legacy styling for now.
    ".transcript-mode": {
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.crust} !important`
                : `${colors.dark.crust} !important`,
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : "none !important",
        color: "#575279 !important",
        fontSize: "0.9rem !important",
    },
    // Neutral Folio control: quiet surface, hairline, no hover lift.
    ".switch-mode": {
        display: "inline-flex",
        height: "35px !important",
        borderRadius: "folioControl !important",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "transparent !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        color: "folio.ink !important",
    },
    ".switch-mode:hover": {
        backgroundColor: "folio.hover !important",
    },
    ".dark-toggle": {
        backgroundColor: "transparent !important",
        border: "none !important",
        color: "folio.muted !important",
        borderRadius: "folioControl !important",
    },
    ".dark-toggle:hover": {
        backgroundColor: "folio.hover !important",
        cursor: "pointer",
    },
});

const _lo = toggleStyles({ colorMode: "light" });
const _do = toggleStyles({ colorMode: "dark" });
export const toggleGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    toggleGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
