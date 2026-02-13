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
    ".splash-bg": {
        position: "relative",
        overflow: "hidden",
        background:
            props.colorMode === "light"
                ? "linear-gradient(135deg, #ff6b35 0%, #f7931e 25%, #ff8c42 50%, #ffa62b 75%, #ff6b35 100%)"
                : "linear-gradient(135deg, #cc4125 0%, #cc5500 25%, #e65c00 50%, #cc4125 75%, #cc5500 100%)",
        "&::before": {
            content: '""',
            position: "absolute",
            top: "-50%",
            left: "-50%",
            width: "200%",
            height: "200%",
            background:
                props.colorMode === "light"
                    ? "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,107,53,0.4) 0%, transparent 40%), radial-gradient(circle at 20% 80%, rgba(247,147,30,0.4) 0%, transparent 40%)"
                    : "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,107,53,0.2) 0%, transparent 40%), radial-gradient(circle at 20% 80%, rgba(247,147,30,0.2) 0%, transparent 40%)",
            animation: "swirl 20s ease-in-out infinite",
            borderRadius: "40%",
            zIndex: -1,
        },
        "&::after": {
            content: '""',
            position: "absolute",
            top: "-50%",
            left: "-50%",
            width: "200%",
            height: "200%",
            background:
                props.colorMode === "light"
                    ? "radial-gradient(circle at 60% 40%, rgba(255,166,43,0.3) 0%, transparent 45%), radial-gradient(circle at 40% 60%, rgba(255,107,53,0.3) 0%, transparent 45%)"
                    : "radial-gradient(circle at 60% 40%, rgba(255,166,43,0.15) 0%, transparent 45%), radial-gradient(circle at 40% 60%, rgba(255,107,53,0.15) 0%, transparent 45%)",
            animation: "swirl 25s ease-in-out infinite reverse",
            borderRadius: "40%",
            zIndex: -1,
        },
    },
    "@keyframes swirl": {
        "0%": {
            transform: "rotate(0deg)",
        },
        "50%": {
            transform: "rotate(180deg)",
        },
        "100%": {
            transform: "rotate(360deg)",
        },
    },
});
