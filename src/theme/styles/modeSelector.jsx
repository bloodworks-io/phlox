// Styles for the mode selector components.
import { colors } from "../colors";

export const modeSelectorStyles = (props) => ({
    ".mode-selector": {
        position: "relative",
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.crust} !important`
                : `${colors.dark.surface} !important`,
        border: props.colorMode === "light" ? "none !important" : `none`,
        borderRadius: "full !important",
        overflow: "hidden",
        width: "300px",
        height: "40px",
        ".chakra-button": {
            transition: "color 0.3s ease",
            height: "38px",
            "&:hover": {
                backgroundColor: "transparent !important",
            },
        },
    },

    // New compact template mode selector styles
    ".template-mode-selector": {
        position: "relative",
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.crust} !important`
                : `${colors.dark.surface} !important`,
        border: props.colorMode === "light" ? "none !important" : `none`,
        borderRadius: "full !important",
        overflow: "hidden",
        width: "200px", // Smaller width
        height: "32px", // Smaller height
        ".chakra-button": {
            transition: "color 0.3s ease",
            height: "30px", // Smaller height
            fontSize: "sm", // Smaller font
            "&:hover": {
                backgroundColor: "transparent !important",
            },
        },
    },

    ".mode-selector-indicator": {
        position: "absolute",
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface2} !important`
                : `${colors.dark.crust} !important`,
        borderRadius: "full !important",
        height: "calc(100% - 4px) !important",
        width: "50% !important",
        transition: "left 0.3s ease !important",
    },

    // Template mode selector indicator (same as above but with specific class)
    ".template-mode-selector-indicator": {
        position: "absolute",
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface2} !important`
                : `${colors.dark.crust} !important`,
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
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
        "&.active": {
            color:
                props.colorMode === "light"
                    ? `${colors.light.base} !important`
                    : `${colors.dark.invertedText} !important`,
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
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
        "&.active": {
            color:
                props.colorMode === "light"
                    ? `${colors.light.base} !important`
                    : `${colors.dark.invertedText} !important`,
        },
    },
});
