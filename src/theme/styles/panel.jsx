// Style definitions for panel components.
const panelStyles = () => ({
    ".panel-header": {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid !important",
        borderBottomColor: "folio.line !important",
    },
    ".settings-panel": {
        backgroundColor: "folio.paper",
        color: "folio.ink",
        border: "1px solid",
        borderColor: "folio.line",
        borderRadius: "folioPanel",
    },
    ".splash-panel": {
        backgroundColor: "folio.paper",
        color: "folio.ink",
        border: "1px solid",
        borderColor: "folio.line",
        borderRadius: "folioOverlay !important",
        boxShadow: "overlay",
    },

    ".splash-bg": {
        position: "relative",
        overflow: "hidden",
        isolation: "isolate",
        backgroundColor: "folio.canvas",
    },
});

const _lo = panelStyles();
const _do = panelStyles();
export const panelGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    panelGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
