// Style definitions for panel components.
import { colors } from "../colors";

const panelStyles = (props) => ({
    ".panel": {
        backgroundColor:
            props.colorMode === "light"
                ? colors.light.secondary
                : colors.dark.secondary,
        color:
            props.colorMode === "light"
                ? colors.light.textSecondary
                : colors.dark.textSecondary,
        borderRadius: "lg",
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface}`
                : `1px solid ${colors.dark.surface}`,
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
        borderRadius: "lg",
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
        borderColor:
            props.colorMode === "light"
                ? colors.light.surface
                : colors.dark.surface,
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `1px solid ${colors.dark.surface} !important`,
        borderRadius: "xl !important",
        fontSize: "1rem !important",
        fontWeight: "700",
    },
    ".splash-panel": {
        backgroundColor: "folio.paper",
        color: "folio.ink",
        border: "1px solid",
        borderColor: "folio.line",
        borderRadius: "folioOverlay !important",
        boxShadow: "overlay",
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
        borderColor:
            props.colorMode === "light"
                ? colors.light.surface
                : colors.dark.surface,
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

    ".splash-bg": {
        position: "relative",
        overflow: "hidden",
        isolation: "isolate",
        backgroundColor: "folio.canvas",
    },
});

const _lo = panelStyles({ colorMode: "light" });
const _do = panelStyles({ colorMode: "dark" });
export const panelGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    panelGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
