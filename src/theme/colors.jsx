// Application palette.
import { lightenColor } from "./utils";


const folioPalette = {
    "folio.canvas": { light: "#f3f0e9", dark: "#262b25" },
    "folio.paper": { light: "#fffdf8", dark: "#30362d" },
    "folio.paperAlt": { light: "#ede8de", dark: "#3a4137" },
    "folio.sidebar": { light: "#272a24", dark: "#1c201b" },
    "folio.sidebarAlt": { light: "#34392f", dark: "#2c332a" },
    "folio.sidebarInk": { light: "#f4f1e8", dark: "#f0eee6" },
    "folio.sidebarMuted": { light: "#bfc5b7", dark: "#b7bdb0" },
    "folio.ink": { light: "#262b25", dark: "#f0eee6" },
    "folio.muted": { light: "#5e675c", dark: "#b8bdb1" },
    "folio.faint": { light: "#737c6f", dark: "#98a091" },
    "folio.line": { light: "#d8d3c7", dark: "#485045" },
    "folio.accent": { light: "#854127", dark: "#e3a17f" },
    "folio.accentInk": { light: "#ffffff", dark: "#2a1b14" },
    "folio.accentSoft": { light: "#f0dcd0", dark: "#4b352b" },
    "folio.brand": { light: "#d55c2c", dark: "#f08a58" },
    "folio.brandOnSidebar": { light: "#f0a07d", dark: "#f0a07d" },
    "folio.brandInk": { light: "#ffffff", dark: "#2b170f" },
    "folio.badgeInk": { light: "#ffffff", dark: "#2b1513" },
    "folio.success": { light: "#35644b", dark: "#a9d5b1" },
    "folio.successSoft": { light: "#e0ebdd", dark: "#304536" },
    "folio.successInk": { light: "#ffffff", dark: "#1d3122" },
    "folio.danger": { light: "#b42318", dark: "#ff9b96" },
    "folio.dangerInk": { light: "#ffffff", dark: "#2b1513" },
    "folio.dangerSoft": { light: "#f9ece6", dark: "#413e35" },
    "folio.warning": { light: "#8a5a12", dark: "#e6c179" },
    "folio.warningInk": { light: "#ffffff", dark: "#2b2111" },
    "folio.warningSoft": { light: "#f4eee3", dark: "#404334" },
    "folio.info": { light: "#3d6391", dark: "#a8c8e8" },
    "folio.infoInk": { light: "#ffffff", dark: "#16283a" },
    "folio.infoSoft": { light: "#e8ebec", dark: "#3e4843" },
    "folio.selection": { light: "#e8e2d4", dark: "#414a3c" },
    "folio.selectionInk": { light: "#262b25", dark: "#f0eee6" },
    "folio.hover": { light: "#eae5db", dark: "#363e34" },
    "folio.focus": { light: "#a24b25", dark: "#f4c5a8" },
};

export const folioShadowTokens = {
    overlay: {
        value: {
            base: "0 12px 32px rgba(58, 42, 25, 0.08)",
            _dark: "0 16px 36px rgba(0, 0, 0, 0.28)",
        },
    },
};

export const folioRadiusTokens = {
    folioControl: { value: "4px" },
    folioPanel: { value: "7px" },
    folioOverlay: { value: "10px" },
};

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
    primaryButton: { light: "#179299", dark: "#8bd5ca" },
    dangerButton: { light: "#d20f39", dark: "#ed8796" },
    successButton: { light: "#40a02b", dark: "#a6da95" },
    secondaryButton: { light: "#df8e1d", dark: "#eed49f" },
    neutralButton: { light: "#7287fd", dark: "#b7bdf8" },
    tertiaryButton: { light: "#dd7878", dark: "#f5bde6" },
    chatIcon: { light: "#8839ef", dark: "#c6a0f6" },
    extraButton: { light: "#ea76cb", dark: "#f5c2e7" },
    border: { light: "#bcc0cc", dark: "#494d64" },
    accent: { light: "#179299", dark: "#8bd5ca" },
    brand: { light: "#fe640b", dark: "#f5a97f" },
    brandFaint: { light: "#fe640bcc", dark: "#f5a97f66" },
    surfaceMuted: { light: "#e6e9ef", dark: "#363a4f" },
    surfaceInset: { light: "#eff1f5", dark: "#181926" },
    hoverOverlay: { light: "rgba(255,255,255,0.6)", dark: "rgba(0,0,0,0.6)" },
    tile: { light: "#eff1f5", dark: "#181926" },
    cardBg: { light: "#ffffff", dark: "#363a4f" },
    scrim: { light: "rgba(255,255,255,0.9)", dark: "rgba(0,0,0,0.7)" },
    scrimSoft: { light: "rgba(255,255,255,0.7)", dark: "rgba(0,0,0,0.5)" },
    scrollbarThumb: { light: "#CBD5E0", dark: "#4A5568" },
    sendButton: { light: "#4c4f69", dark: "#ffffff" },
    sendButtonDisabled: { light: "#acb0be", dark: "rgba(255,255,255,0.2)" },
    sendButtonHover: { light: "#6c6f85", dark: "#e6e9ef" },
    sendButtonHoverDisabled: {
        light: "#8c8fa1",
        dark: "rgba(255,255,255,0.3)",
    },
    sendButtonText: { light: "#ffffff", dark: "#4c4f69" },
    sendButtonTextDisabled: { light: "#8c8fa1", dark: "rgba(255,255,255,0.5)" },
    primaryButtonFaint: { light: "#17929915", dark: "#8bd5ca15" },
    dangerButtonFaint: { light: "#d20f3915", dark: "#ed879620" },
    surfaceQuartile: { light: "#ccd0da40", dark: "#363a4f40" },
    primaryButtonHalftone: { light: "#17929980", dark: "#8bd5ca80" },
    sidebarBackgroundFaint: { light: "#23263415", dark: "#1e203015" },
    "buttonBorder.primary": { light: "#147c82", dark: "#76b5ac" },
    "buttonBorder.neutral": { light: "#6173d7", dark: "#9ca1d3" },
    extraButtonHover: { light: "#ec84d0", dark: "#f6c8e9" },
    crustHover: { light: "#e0e3ea", dark: "#2f303c" },
    "sidebar.itemBorder": { light: "#373b4c", dark: "#2e3143" },
    "sidebar.toggleHoverBg": { light: "#20222f", dark: "#1b1d2b" },
    divider: { light: "#bcc0cc", dark: "#494d64" },
    "sidebar.background": { light: "#232634", dark: "#1e2030" },
    "sidebar.item": { light: "#414559", dark: "#363a4f" },
    "sidebar.hover": { light: "#626880", dark: "#363a4f" },
    "sidebar.text": { light: "#e6e9ef", dark: "#cad3f5" },
    "buttonHover.primary": {
        light: lightenColor("#179299"),
        dark: lightenColor("#8bd5ca"),
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
    ...folioPalette,
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
const buildFlatView = (source, mode) => {
    const view = {};
    for (const [name, pair] of Object.entries(source)) {
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
    light: buildFlatView(palette, "light"),
    dark: buildFlatView(palette, "dark"),
};

export const folioColors = {
    light: buildFlatView(folioPalette, "light").folio,
    dark: buildFlatView(folioPalette, "dark").folio,
};
