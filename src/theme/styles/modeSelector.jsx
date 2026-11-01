// Styles for the mode selector components.

const modeSelectorStyles = () => ({
    ".mode-selector": {
        position: "relative",
        backgroundColor: "folio.paperAlt !important",
        border: "none !important",
        borderRadius: "full !important",
        overflow: "hidden",
        width: "240px",
        height: "34px",
        ".chakra-button": {
            transition: "color 160ms ease",
            height: "32px",
            fontSize: "xs",
            "&:hover": {
                backgroundColor: "transparent !important",
            },
        },
    },

    // New compact template mode selector styles
    ".template-mode-selector": {
        position: "relative",
        backgroundColor: "folio.paperAlt !important",
        border: "none !important",
        borderRadius: "full !important",
        overflow: "hidden",
        width: "200px", // Smaller width
        height: "32px", // Smaller height
        ".chakra-button": {
            transition: "color 160ms ease",
            height: "30px", // Smaller height
            fontSize: "sm", // Smaller font
            "&:hover": {
                backgroundColor: "transparent !important",
            },
        },
    },

    ".mode-selector-indicator": {
        position: "absolute",
        backgroundColor: "folio.selection !important",
        borderRadius: "full !important",
        height: "calc(100% - 4px) !important",
        width: "50% !important",
        transition: "left 0.3s ease !important",
    },

    // Template mode selector indicator (same as above but with specific class)
    ".template-mode-selector-indicator": {
        position: "absolute",
        backgroundColor: "folio.selection !important",
        borderRadius: "full !important",
        height: "calc(100% - 4px) !important",
        width: "50% !important",
        transition: "left 0.3s ease !important",
    },

    ".mode-selector-button": {
        flex: "1",
        variant: "ghost",
        backgroundColor: "transparent !important",
        "&:hover": {
            backgroundColor: "transparent !important",
        },
        color: "folio.muted !important",
        "&.active": {
            color: "folio.selectionInk !important",
        },
    },

    // Template mode selector button (same as above but with specific class)
    ".template-mode-selector-button": {
        flex: "1",
        variant: "ghost",
        backgroundColor: "transparent !important",
        "&:hover": {
            backgroundColor: "transparent !important",
        },
        color: "folio.muted !important",
        "&.active": {
            color: "folio.selectionInk !important",
        },
    },
});

const _lo = modeSelectorStyles({ colorMode: "light" });
const _do = modeSelectorStyles({ colorMode: "dark" });
export const modeSelectorGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    modeSelectorGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
