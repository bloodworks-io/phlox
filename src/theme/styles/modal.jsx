// Styles for modal components.

const modalStyles = () => ({
    ".modal-style": {
        backgroundColor: "folio.paper !important",
        border: "1px solid !important",
        borderColor: "folio.line !important",
        color: "folio.ink !important",
        fontSize: "0.9rem !important",
        padding: "0px !important",
        borderRadius: "folioOverlay !important",
        marginBlock: "auto !important",
        boxShadow: "overlay !important",
    },
});

const _lo = modalStyles({ colorMode: "light" });
const _do = modalStyles({ colorMode: "dark" });
export const modalGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    modalGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
