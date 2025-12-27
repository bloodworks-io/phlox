// Styles for button components
import { colors } from "../colors";
import { darkenColor } from "../utils";

export const buttonStyles = (props) => ({
    ".refresh-icon-button": {
        backgroundColor:
            props.colorMode === "light"
                ? colors.light.neutralButton
                : colors.dark.neutralButton,
        color:
            props.colorMode === "light"
                ? colors.light.invertedText
                : colors.dark.invertedText,
        borderRadius: "lg !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.neutralButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.neutralButton, 0.15)} !important`,
        _hover: {
            backgroundColor:
                props.colorMode === "light"
                    ? colors.light.buttonHover.neutral
                    : colors.dark.buttonHover.neutral,
        },
        _active: {
            backgroundColor:
                props.colorMode === "light"
                    ? colors.light.neutralButton
                    : colors.dark.neutralButton,
        },
    },
    ".nav-button": {
        marginTop: "4px",
        background: colors.light.primaryButton,
        fontSize: "0.9rem",
        padding: "6px 12px",
        borderRadius: "lg",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.primaryButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.primaryButton, 0.15)} !important`,
    },
    ".nav-button:hover": {
        background: colors.light.buttonHover.primary,
    },
    ".small-nav-button": {
        marginTop: "4px",
        background: colors.light.primaryButton,
        fontSize: "0.8rem",
        padding: "4px 8px",
        borderRadius: "lg",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.primaryButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.primaryButton, 0.15)} !important`,
    },
    ".small-nav-button:hover": {
        background: colors.light.buttonHover.primary,
    },
    ".summary-buttons": {
        backgroundColor: `${colors.light.primaryButton} !important`,
        color: `${colors.light.invertedText} !important`,
        borderRadius: "lg !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.primaryButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.primaryButton, 0.15)} !important`,
    },
    ".summary-buttons:hover": {
        backgroundColor: `${colors.light.buttonHover.primary} !important`,
        cursor: "pointer",
    },
    ".red-button": {
        backgroundColor: `${colors.light.dangerButton} !important`,
        color: `${colors.light.invertedText} !important`,
        height: "35px !important",
        borderRadius: "lg !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.dangerButton, 0.15)} !important`
                : `none !important`,
    },
    ".red-button:hover": {
        backgroundColor: `${colors.light.buttonHover.danger} !important`,
        color: `${colors.light.invertedText} !important`,
    },
    ".tertiary-button": {
        backgroundColor: `${colors.light.tertiaryButton} !important`,
        color: `${colors.light.base} !important`,
        height: "35px !important",
        borderRadius: "md !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.tertiaryButton, 0.15)} !important`
                : `none !important`,
    },
    ".tertiary-button:hover": {
        backgroundColor: `${colors.light.buttonHover.tertiary} !important`,
        color: `${colors.light.invertedText} !important`,
    },
    ".orange-button": {
        backgroundColor: `${colors.light.secondaryButton} !important`,
        color: `${colors.light.invertedText} !important`,
        height: "35px !important",
        borderRadius: "lg !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.secondaryButton, 0.15)} !important`
                : `none !important`,
    },
    ".orange-button:hover": {
        backgroundColor: `${colors.light.buttonHover.secondary} !important`,
        color: `${colors.light.invertedText} !important`,
    },
    ".green-button": {
        backgroundColor: `${colors.light.successButton} !important`,
        color: `${colors.light.invertedText} !important`,
        height: "35px !important",
        borderRadius: "lg !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.successButton, 0.15)} !important`
                : `none !important`,
    },
    ".green-button:hover": {
        backgroundColor: `${colors.light.buttonHover.success} !important`,
        color: `${colors.light.invertedText} !important`,
    },
    ".settings-button": {
        backgroundColor: `${colors.light.neutralButton} !important`,
        color: `${colors.light.invertedText} !important`,
        borderRadius: "lg !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.neutralButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.neutralButton, 0.15)} !important`,
    },
    ".settings-button:hover": {
        backgroundColor: `${colors.light.buttonHover.neutral} !important`,
        cursor: "pointer",
    },
    ".chat-send-button": {
        backgroundColor: `${colors.light.secondaryButton} !important`,
        color: `${colors.light.invertedText} !important`,
        borderRadius: "full !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.secondaryButton, 0.15)} !important`
                : `none !important`,
    },
    ".chat-send-button:hover": {
        backgroundColor: `${colors.light.buttonHover.secondary} !important`,
        color: `${colors.light.invertedText} !important`,
    },
    ".grey-button": {
        borderRadius: "lg !important",
        fontWeight: "normal",
        height: "35px !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `1px solid ${colors.dark.surface} !important`,
        // Default (outline) state
        "&[variant=outline]": {
            backgroundColor:
                props.colorMode === "light"
                    ? `${colors.light.crust} !important`
                    : `${colors.dark.overlay0} !important`,
            color:
                props.colorMode === "light"
                    ? `${colors.light.textSecondary} !important`
                    : `${colors.dark.textSecondary} !important`,
            _hover: {
                backgroundColor:
                    props.colorMode === "light"
                        ? `${colors.light.crust} !important`
                        : `${colors.dark.surface1} !important`, // Slightly different hover background
            },
        },
        // Solid state (when selected)
        "&[variant=solid]": {
            backgroundColor:
                props.colorMode === "light"
                    ? `${colors.light.crust} !important`
                    : `${colors.dark.overlay0} !important`,
            color:
                props.colorMode === "light"
                    ? `${colors.light.textPrimary} !important`
                    : `${colors.dark.textPrimary} !important`,
            _hover: {
                backgroundColor:
                    props.colorMode === "light"
                        ? `${colors.light.surface} !important`
                        : `${colors.dark.surface2} !important`, // Slightly different hover for solid
            },
        },
    },
});
