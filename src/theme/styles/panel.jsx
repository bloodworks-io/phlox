// Style definitions for panel components.
import { colors } from "../colors";

export const panelStyles = (props) => ({
    ".panel": {
        backgroundColor:
            props.colorMode === "light"
                ? colors.light.secondary
                : colors.dark.secondary,
        color:
            props.colorMode === "light"
                ? colors.light.textSecondary
                : colors.dark.textSecondary,
        borderRadius: "sm",
        shadow: "sm",
    },
    ".panel-header": {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `1px solid ${colors.dark.surface} !important`,
    },
    ".panel-content": {
        backgroundColor:
            props.colorMode === "light" ? colors.light.base : colors.dark.crust,
        color:
            props.colorMode === "light"
                ? colors.light.textSecondary
                : colors.dark.textSecondary,
        borderRadius: "sm",
        padding: 4,
        maxHeight: "400px",
        overflowY: "auto",
    },
    ".panels-bg": {
        backgroundColor:
            props.colorMode === "light"
                ? colors.light.secondary
                : colors.dark.secondary,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
        borderColor: "#cecacd",
        border: "none !important",
        borderRadius: "md !important",
        fontSize: "1rem !important",
        fontWeight: "700",
    },
    ".summary-panels": {
        backgroundColor:
            props.colorMode === "light"
                ? colors.light.secondary
                : colors.dark.secondary,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
        borderColor: "#cecacd",
        border: "none !important",
        fontSize: "1rem !important",
        fontWeight: "normal",
    },
    ".summary-checkboxes": {
        backgroundColor:
            props.colorMode === "light"
                ? colors.light.secondary
                : colors.dark.secondary,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
    },
});
