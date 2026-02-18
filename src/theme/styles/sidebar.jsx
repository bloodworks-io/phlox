import { colors } from "../colors";
import { darkenColor } from "../utils";

export const sidebarStyles = (props) => ({
    ".sidebar": {
        position: "fixed",
        top: 0,
        left: 0,
        width: "200px",
        height: "100vh",
        background:
            props.colorMode === "light"
                ? colors.light.sidebar.background
                : colors.dark.sidebar.background,
        color: colors.light.sidebar.text,
        boxShadow: "lg",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontSize: "1rem !important",
        fontWeight: "700",
    },

    ".sidebar-patient-items": {
        backgroundColor:
            props.colorMode === "light"
                ? colors.light.sidebar.item
                : colors.dark.sidebar.item,
        color: colors.light.invertedText,
        height: "32px",
        fontSize: "0.9rem !important",
        fontWeight: "normal",
        borderRadius: "lg !important",
        margin: "4px 0",
        transition: "all 0.2s ease",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.sidebar.item, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.sidebar.item, 0.15)} !important`,
    },
    ".sidebar-patient-items:hover": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.sidebar.hover} !important`
                : `${colors.dark.sidebar.hover} !important`,
        color: colors.light.invertedText,
        cursor: "pointer !important",
        transform: "translateY(-1px)",
        boxShadow: "sm",
    },
    ".sidebar-patient-items-delete": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.sidebar.hover} !important`
                : `${colors.dark.sidebar.hover} !important`,
        color: `${colors.light.invertedText} !important`,
        borderRadius: "lg !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.dangerButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.dangerButton, 0.15)} !important`,
        transition: "all 0.2s ease",
    },
    ".sidebar-patient-items-delete:hover": {
        backgroundColor: `${colors.light.dangerButton} !important`,
        color: colors.light.invertedText,
        transform: "translateY(-1px)",
        boxShadow: "sm",
    },
    ".new-patient": {
        padding: "2px 8px",
        borderRadius: "lg !important",
        background: `${colors.light.tertiaryButton} !important`,
        marginTop: "6px",
        marginBottom: "6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "36px",
        fontWeight: "500",
        fontSize: "0.9rem",
        transition: "all 0.2s ease",
        border: `1px solid ${darkenColor(colors.light.tertiaryButton, 0.15)} !important`,
    },
    ".new-patient:hover": {
        background: `${colors.light.buttonHover.tertiary} !important`,
        cursor: "pointer !important",
        transform: "translateY(-1px)",
        boxShadow: "md",
    },
    ".patient": {
        padding: "2px 8px",
        borderRadius: "lg",
        background: "gray.700",
        marginBottom: "4px",
        marginTop: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "36px",
        transition: "all 0.2s ease",
    },
    ".patient.hover": {
        background: "gray.600",
        cursor: "pointer",
        transform: "translateY(-1px)",
        boxShadow: "sm",
    },
    ".settings": {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
            props.colorMode === "light"
                ? colors.light.neutralButton
                : colors.dark.neutralButton,
        padding: "2px 8px",
        borderRadius: "lg",
        height: "36px",
        width: "90%",
        margin: "0 auto 12px auto",
        fontSize: "0.9rem",
        fontWeight: "500",
        transition: "all 0.2s ease",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.neutralButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.neutralButton, 0.15)} !important`,
    },
    ".settings:hover": {
        background:
            props.colorMode === "light"
                ? colors.light.buttonHover.neutral
                : colors.dark.buttonHover.neutral,
        cursor: "pointer",
        transform: "translateY(-1px)",
        boxShadow: "md",
    },
    ".sidebar-toggle": {
        background:
            props.colorMode === "light"
                ? `${colors.light.sidebar.background} !important`
                : `${colors.dark.sidebar.background} !important`,
        color: `${colors.dark.textTertiary} !important`,
        zIndex: "200",
        borderRadius: "lg !important",
        transition: "all 0.2s ease",
    },

    ".sidebar-toggle:hover": {
        background:
            props.colorMode === "light"
                ? `${darkenColor(colors.light.sidebar.background, 0.1)} !important`
                : `${darkenColor(colors.dark.sidebar.background, 0.1)} !important`,
    },
    // Patient list items styling - consistent in both modes
    ".patient-list-item": {
        backgroundColor: `${colors.dark.sidebar.item} !important`,
        color: `${colors.dark.textPrimary} !important`,
        transition: "all 0.2s ease",
        _hover: {
            backgroundColor: `${colors.dark.sidebar.hover} !important`,
        },
    },

    // Sidebar section labels
    ".sidebar-section-label": {
        color: `${colors.dark.textSecondary} !important`,
        fontSize: "xs",
        fontWeight: "medium",
    },

    // Consistent text color for sidebar elements
    ".sidebar-text": {
        color: `${colors.dark.textPrimary} !important`,
    },

    // Sidebar dividers
    ".sidebar-divider": {
        borderColor: `${colors.dark.divider} !important`,
    },

    // Avatar button for New Patient
    ".avatar-button": {
        transition: "all 0.2s ease",
        _hover: {
            backgroundColor: "rgba(184, 192, 224, 0.1) !important",
        },
    },
});
