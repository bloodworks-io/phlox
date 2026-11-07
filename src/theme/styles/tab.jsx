// Defines visual styles for tab components within the application.

const tabStyles = () => ({
    ".tab-style": {
        backgroundColor: "transparent !important",
        borderRadius: "0 !important",
        borderTopLeftRadius: "folioControl !important",
        borderTopRightRadius: "folioControl !important",
        marginBottom: "-1px",
        fontSize: "16px !important",
        fontWeight: "400 !important",
        transition:
            "background-color 160ms ease, color 160ms ease, border-color 160ms ease !important",
    },
    // Accent ink keeps the active tab distinct even on the folio.canvas body
    // it now merges with, where ink-on-canvas read as no state at all.
    ".tab-style[aria-selected='true']": {
        backgroundColor: "folio.canvas !important",
        color: "folio.accent !important",
        border: "none",
        // Non-colour cue: the selected surface is the same colour as the
        // content body it faces, so weight — not hue — carries the state.
        fontWeight: "600 !important",
    },
    ".tab-style[aria-selected='false']": {
        backgroundColor: "transparent !important",
        color: "folio.muted !important",
    },
    // Scoped to unselected tabs so re-hovering the active tab keeps its paper
    // surface; ink text matches the app-wide hover idiom.
    ".tab-style:not([aria-selected='true']):hover": {
        backgroundColor: "folio.hover !important",
        color: "folio.ink !important",
    },
    ".compact-tabs .tab-style": {
        fontSize: "13px !important",
        paddingLeft: "8px !important",
        paddingRight: "8px !important",
    },
    ".tab-panel-container": {
        minHeight: "180px !important",
        display: "flex !important",
        alignItems: "center !important",
        justifyContent: "center !important",
    },
});

const _lo = tabStyles({ colorMode: "light" });
const _do = tabStyles({ colorMode: "dark" });
export const tabGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    tabGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
