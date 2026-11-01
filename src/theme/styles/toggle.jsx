// Defines visual styles for toggle buttons and switches.

const toggleStyles = () => ({
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

const _lo = toggleStyles();
const _do = toggleStyles();
export const toggleGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    toggleGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
