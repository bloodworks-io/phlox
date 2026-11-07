// Application palette.

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

// Chakra v3 semantic-token registration
export const tokens = (() => {
    const out = {};
    for (const [name, { light, dark }] of Object.entries(folioPalette)) {
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

const buildFlatView = (mode) => {
    const view = {};
    for (const [name, pair] of Object.entries(folioPalette)) {
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

// Concrete values for genuine SVG/canvas consumers that cannot consume CSS
// custom properties.
export const folioColors = {
    light: buildFlatView("light").folio,
    dark: buildFlatView("dark").folio,
};
