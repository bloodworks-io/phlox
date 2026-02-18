// Defines visual styles for toggle buttons and switches.
import { colors } from "../colors";

export const toggleStyles = (props) => ({
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
    ".switch-mode": {
        display: "inline-flex",
        borderRadius: "lg !important",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.crust} !important`
                : `${colors.dark.crust} !important`,
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `1px solid ${colors.dark.surface} !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
    },
    ".dark-toggle": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.secondary} !important`
                : `${colors.dark.secondary} !important`,
        border: "none !important",
        color:
            props.colorMode === "light"
                ? `${colors.light.textTertiary} !important`
                : `${colors.dark.textTertiary} !important`,
        borderRadius: "md !important",
    },
    ".dark-toggle:hover": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface} !important`
                : `${colors.dark.surface} !important`,
        cursor: "pointer",
    },
});
