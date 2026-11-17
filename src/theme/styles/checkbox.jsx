// Styles for checkbox components

const checkboxStyles = () => ({
    ".task-checkbox": {
        borderRadius: "sm !important",
    },
    // Folio control surface for the shared task checkbox. Geometry (16px
    // box, 2px radius) and label metrics are preserved; the checked fill
    // comes from the Folio checkmark recipe (accent + accentInk).
    ".task-checkbox .chakra-checkbox__control": {
        borderWidth: "1px !important",
        borderStyle: "solid !important",
        borderColor: "folio.line !important",
        width: "16px !important",
        height: "16px !important",
        borderRadius: "2px !important",
        backgroundColor: "folio.paper !important",
        color: "folio.ink !important",
    },
    ".task-checkbox .chakra-checkbox__label": {
        fontSize: "16px !important",
        lineHeight: "20px !important",
        fontWeight: "400 !important",
        color: "folio.muted !important",
    },
});

const _lo = checkboxStyles({ colorMode: "light" });
const _do = checkboxStyles({ colorMode: "dark" });
export const checkboxGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    checkboxGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
