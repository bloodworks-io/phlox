// Defines the color palettes for the application in light and dark mode.
import { lightenColor } from "./utils";

const baseColorsLight = {
    base: "#eff1f5",
    secondary: "#e6e9ef",
    surface: "#ccd0da",
    surface2: "#acb0be",
    crust: "#dce0e8",
    overlay0: "#8c8fa1",
    textPrimary: "#4c4f69",
    textSecondary: "#6c6f85",
    textTertiary: "#5c5f77",
    textQuaternary: "#7c7f93",
    invertedText: "#e6e9ef",
    primaryButton: "#179299",
    dangerButton: "#d20f39",
    successButton: "#40a02b",
    secondaryButton: "#df8e1d",
    neutralButton: "#7287fd",
    tertiaryButton: "#dd7878",
    chatIcon: "#8839ef",
    extraButton: "#ea76cb",
    sidebar: {
        background: "#232634",
        item: "#414559",
        hover: "#626880",
        text: "#e6e9ef",
    },
};

const baseColorsDark = {
    base: "#24273a",
    secondary: "#1e2030",
    surface: "#363a4f",
    surface1: "#494d64",
    surface2: "#5b6078",
    crust: "#181926",
    overlay0: "#6e738d",
    overlay2: "#939ab7",
    textPrimary: "#cad3f5",
    textSecondary: "#a5adcb",
    textTertiary: "#b8c0e0",
    textQuaternary: "#6e738d",
    invertedText: "#cad3f5",
    primaryButton: "#8aadf4",
    dangerButton: "#ed8796",
    successButton: "#a6da95",
    secondaryButton: "#eed49f",
    neutralButton: "#b7bdf8",
    tertiaryButton: "#f5bde6",
    extraButton: "#f5c2e7",
    chatIcon: "#c6a0f6",
    sidebar: {
        background: "#1e2030",
        item: "#363a4f",
        hover: "#363a4f",
    },
};

export const colors = {
    light: {
        ...baseColorsLight,
        buttonHover: {
            primary: lightenColor(baseColorsLight.primaryButton),
            danger: lightenColor(baseColorsLight.dangerButton),
            success: lightenColor(baseColorsLight.successButton),
            secondary: lightenColor(baseColorsLight.secondaryButton),
            neutral: lightenColor(baseColorsLight.neutralButton),
            tertiary: lightenColor(baseColorsLight.tertiaryButton),
        },
    },
    dark: {
        ...baseColorsDark,
        buttonHover: {
            primary: lightenColor(baseColorsDark.primaryButton),
            danger: lightenColor(baseColorsDark.dangerButton),
            success: lightenColor(baseColorsDark.successButton),
            secondary: lightenColor(baseColorsDark.secondaryButton),
            neutral: lightenColor(baseColorsDark.neutralButton),
            tertiary: lightenColor(baseColorsDark.tertiaryButton),
        },
    },
};
