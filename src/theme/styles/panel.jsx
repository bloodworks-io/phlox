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
        borderRadius: "2xl !important",
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
        "&::before": {
            content: '""',
            position: "absolute",
            top: "-30%",
            left: "-30%",
            width: "160%",
            height: "160%",
            background:
                props.colorMode === "light"
                    ? `radial-gradient(circle at 30% 30%, rgba(254,100,11,0.20) 0%, transparent 45%), radial-gradient(circle at 75% 25%, rgba(23,146,153,0.16) 0%, transparent 45%), radial-gradient(circle at 55% 80%, rgba(114,135,253,0.16) 0%, transparent 45%), #e6e9ef`
                    : `radial-gradient(circle at 30% 30%, rgba(245,169,127,0.30) 0%, transparent 45%), radial-gradient(circle at 75% 25%, rgba(139,213,202,0.22) 0%, transparent 45%), radial-gradient(circle at 55% 80%, rgba(183,189,248,0.20) 0%, transparent 45%), ${colors.dark.crust}`,
            animation: "phloxAuroraDrift 26s ease-in-out infinite",
            zIndex: -1,
        },
        "&::after": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
                props.colorMode === "light"
                    ? "radial-gradient(circle, rgba(36,39,58,0.07) 1px, transparent 1px)"
                    : "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage:
                "radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 75%)",
            WebkitMaskImage:
                "radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 75%)",
            zIndex: -1,
        },
    },
    "@keyframes phloxAuroraDrift": {
        "0%, 100%": {
            transform: "translate(0%, 0%) scale(1)",
        },
        "33%": {
            transform: "translate(4%, -3%) scale(1.06)",
        },
        "66%": {
            transform: "translate(-3%, 4%) scale(0.96)",
        },
    },
});

const _lo = panelStyles({ colorMode: "light" });
const _do = panelStyles({ colorMode: "dark" });
export const panelGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    panelGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
