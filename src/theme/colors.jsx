// Application palette.
import { lightenColor } from "./utils";

const palette = {
    base: { light: "#eff1f5", dark: "#24273a" },
    secondary: { light: "#e6e9ef", dark: "#1e2030" },
    surface: { light: "#ccd0da", dark: "#363a4f" },
    surface1: { light: "#bcc0cc", dark: "#494d64" },
    surface2: { light: "#acb0be", dark: "#5b6078" },
    crust: { light: "#dce0e8", dark: "#181926" },
    overlay0: { light: "#8c8fa1", dark: "#6e738d" },
    overlay2: { light: "#939ab7", dark: "#939ab7" },
    textPrimary: { light: "#4c4f69", dark: "#cad3f5" },
    textSecondary: { light: "#6c6f85", dark: "#a5adcb" },
    textTertiary: { light: "#5c5f77", dark: "#b8c0e0" },
    textQuaternary: { light: "#7c7f93", dark: "#6e738d" },
    invertedText: { light: "#e6e9ef", dark: "#cad3f5" },
    primaryButton: { light: "#179299", dark: "#8aadf4" },
    dangerButton: { light: "#d20f39", dark: "#ed8796" },
    successButton: { light: "#40a02b", dark: "#a6da95" },
    secondaryButton: { light: "#df8e1d", dark: "#eed49f" },
    neutralButton: { light: "#7287fd", dark: "#b7bdf8" },
    tertiaryButton: { light: "#dd7878", dark: "#f5bde6" },
    chatIcon: { light: "#8839ef", dark: "#c6a0f6" },
    extraButton: { light: "#ea76cb", dark: "#f5c2e7" },
    border: { light: "#bcc0cc", dark: "#494d64" },
    accent: { light: "#179299", dark: "#8aadf4" },
    surfaceMuted: { light: "#e6e9ef", dark: "#363a4f" },
    surfaceInset: { light: "#eff1f5", dark: "#181926" },
    hoverOverlay: { light: "rgba(255,255,255,0.6)", dark: "rgba(0,0,0,0.6)" },
    "sidebar.background": { light: "#232634", dark: "#1e2030" },
    "sidebar.item": { light: "#414559", dark: "#363a4f" },
    "sidebar.hover": { light: "#626880", dark: "#363a4f" },
    "sidebar.text": { light: "#e6e9ef", dark: "#cad3f5" },
    "buttonHover.primary": {
        light: lightenColor("#179299"),
        dark: lightenColor("#8aadf4"),
    },
    "buttonHover.danger": {
        light: lightenColor("#d20f39"),
        dark: lightenColor("#ed8796"),
    },
    "buttonHover.success": {
        light: lightenColor("#40a02b"),
        dark: lightenColor("#a6da95"),
    },
    "buttonHover.secondary": {
        light: lightenColor("#df8e1d"),
        dark: lightenColor("#eed49f"),
    },
    "buttonHover.neutral": {
        light: lightenColor("#7287fd"),
        dark: lightenColor("#b7bdf8"),
    },
    "buttonHover.tertiary": {
        light: lightenColor("#dd7878"),
        dark: lightenColor("#f5bde6"),
    },
};

// Chakra v3 semantic-token registration
export const tokens = (() => {
    const out = {};
    for (const [name, { light, dark }] of Object.entries(palette)) {
        const set = (path, value) => {
            const parts = path.split(".");
            let node = out;
            for (let i = 0; i < parts.length - 1; i++) {
                node[parts[i]] ??= {};
                node = node[parts[i]];
            }
            node[parts.at(-1)] = value;
        };
        set(name, { value: { base: light, _dark: dark } });
    }
    return out;
})();

// Legacy flat view — do not use in new code.
const buildFlatView = (mode) => {
    const view = {};
    for (const [name, pair] of Object.entries(palette)) {
        const value = pair[mode];
        const parts = name.split(".");
        let node = view;
        for (let i = 0; i < parts.length - 1; i++) {
            node[parts[i]] ??= {};
            node = node[parts[i]];
        }
        node[parts.at(-1)] = value;
    }
    return view;
};

export const colors = {
    light: buildFlatView("light"),
    dark: buildFlatView("dark"),
};
