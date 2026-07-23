// Styles for button components.
import { colors } from "../colors";
import { darkenColor } from "../utils";

const buttonStyles = (props) => ({
    ".nav-button": {
        marginTop: "4px",
        background: `${colors.light.primaryButton} !important`,
        color: `${colors.light.invertedText} !important`,
        fontSize: "0.9rem",
        padding: "6px 12px",
        borderRadius: "full !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.primaryButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.primaryButton, 0.15)} !important`,
    },
    ".nav-button:hover": {
        background: `${colors.light.buttonHover.primary} !important`,
        transform: "translateY(-1px)",
        boxShadow: "md",
    },
    ".small-nav-button": {
        marginTop: "4px",
        background: `${colors.light.primaryButton} !important`,
        color: `${colors.light.invertedText} !important`,
        fontSize: "0.8rem",
        padding: "4px 8px",
        borderRadius: "full !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.primaryButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.primaryButton, 0.15)} !important`,
    },
    ".small-nav-button:hover": {
        background: `${colors.light.buttonHover.primary} !important`,
        transform: "translateY(-1px)",
        boxShadow: "md",
    },
    ".summary-buttons": {
        backgroundColor: `${colors.light.primaryButton} !important`,
        color: `${colors.light.invertedText} !important`,
        borderRadius: "full !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.primaryButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.primaryButton, 0.15)} !important`,
    },
    ".summary-buttons:hover": {
        backgroundColor: `${colors.light.buttonHover.primary} !important`,
        cursor: "pointer",
        transform: "translateY(-1px)",
        boxShadow: "md",
    },
    ".red-button": {
        backgroundColor: `${colors.light.dangerButton} !important`,
        color: `${colors.light.invertedText} !important`,
        height: "35px !important",
        borderRadius: "full !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.dangerButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.dangerButton, 0.15)} !important`,
    },
    ".red-button:hover": {
        backgroundColor: `${colors.light.buttonHover.danger} !important`,
        color: `${colors.light.invertedText} !important`,
        transform: "translateY(-1px)",
        boxShadow: "md",
    },
    ".orange-button": {
        backgroundColor: `${colors.light.secondaryButton} !important`,
        color: `${colors.light.invertedText} !important`,
        height: "35px !important",
        borderRadius: "full !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.secondaryButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.secondaryButton, 0.15)} !important`,
    },
    ".orange-button:hover": {
        backgroundColor: `${colors.light.buttonHover.secondary} !important`,
        color: `${colors.light.invertedText} !important`,
        transform: "translateY(-1px)",
        boxShadow: "md",
    },
    ".green-button": {
        backgroundColor: `${colors.light.successButton} !important`,
        color: `${colors.light.invertedText} !important`,
        height: "35px !important",
        borderRadius: "full !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.successButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.successButton, 0.15)} !important`,
    },
    ".green-button:hover": {
        backgroundColor: `${colors.light.buttonHover.success} !important`,
        color: `${colors.light.invertedText} !important`,
        transform: "translateY(-1px)",
        boxShadow: "md",
    },
    ".chat-send-button": {
        backgroundColor: `${colors.light.secondaryButton} !important`,
        color: `${colors.light.invertedText} !important`,
        borderRadius: "full !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${darkenColor(colors.light.secondaryButton, 0.15)} !important`
                : `1px solid ${darkenColor(colors.dark.secondaryButton, 0.15)} !important`,
    },
    ".chat-send-button:hover": {
        backgroundColor: `${colors.light.buttonHover.secondary} !important`,
        color: `${colors.light.invertedText} !important`,
        transform: "translateY(-1px)",
        boxShadow: "md",
    },
    ".grey-button": {
        borderRadius: "full !important",
        height: "35px !important",
        padding: "0 16px !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `1px solid ${colors.dark.surface} !important`,
        backgroundColor:
            props.colorMode === "light"
                ? `transparent !important`
                : `rgba(255, 255, 255, 0.08) !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.textPrimary} !important`
                : `rgba(255, 255, 255, 0.92) !important`,
        _hover: {
            backgroundColor:
                props.colorMode === "light"
                    ? `${colors.light.crust} !important`
                    : `${colors.dark.surface1} !important`,
        },
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
                        : `${colors.dark.surface1} !important`,
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
                        : `${colors.dark.surface2} !important`,
            },
        },
    },
    ".grey-button.grey-button-sm": {
        height: "28px !important",
        padding: "0 10px !important",
        fontSize: "0.8rem !important",
    },
});

// Pre-evaluate both modes and emit _light/_dark blocks ready for globalCss.
const lightOut = buttonStyles({ colorMode: "light" });
const darkOut = buttonStyles({ colorMode: "dark" });
export const buttonGlobalCss = {};
for (const selector of Object.keys(lightOut)) {
    buttonGlobalCss[selector] = {
        _light: lightOut[selector],
        _dark: darkOut[selector],
    };
}
