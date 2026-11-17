// Styles specifically for the document explorer user interface.
const documentExplorerStyles = () => ({

    ".rag-workspace": {
        backgroundColor: "folio.paper",
        color: "folio.ink",
        border: "1px solid",
        borderColor: "folio.line",
        borderRadius: "folioPanel",
    },
    ".rag-panel": {
        backgroundColor: "folio.paper",
        color: "folio.ink",
        border: "1px solid",
        borderColor: "folio.line",
        borderRadius: "folioPanel",
    },
    // Preserves the compact 0.7rem tab density and the tab-flush top-left
    // corner geometry of the former tab body.
    ".rag-tab-body": {
        backgroundColor: "folio.canvas",
        color: "folio.ink",
        fontWeight: "normal",
        borderTop: "1px solid",
        borderTopColor: "folio.line",
        borderTopLeftRadius: "0",
        borderTopRightRadius: "md",
        borderBottomLeftRadius: "md",
        borderBottomRightRadius: "md",
        fontSize: "0.7rem",
    },
    ".rag-collapse-toggle": {
        border: "none",
        borderRadius: "lg",
        color: "folio.muted",
        backgroundColor: "folio.paperAlt",
    },
    ".rag-row": {
        backgroundColor: "folio.paperAlt",
        color: "folio.ink",
        borderRadius: "folioControl",
        transition: "background-color 0.15s ease",
    },
    ".rag-file-list": {
        backgroundColor: "folio.canvas",
        color: "folio.muted",
    },
});

const _lo = documentExplorerStyles();
const _do = documentExplorerStyles();
export const documentExplorerGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    documentExplorerGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
