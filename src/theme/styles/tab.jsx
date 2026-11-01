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
    ".tab-style[aria-selected='true']": {
        backgroundColor: "folio.paper !important",
        color: "folio.ink !important",
        border: "none",
    },
    ".tab-style[aria-selected='false']": {
        backgroundColor: "transparent !important",
        color: "folio.muted !important",
    },
    ".tab-style:hover": {
        backgroundColor: "folio.hover !important",
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
