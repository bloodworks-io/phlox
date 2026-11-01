import { describe, expect, it } from "vitest";
import { colors, folioColors, folioRadiusTokens, folioShadowTokens, tokens } from "./colors";

const folioPairs = {
    canvas: ["#f3f0e9", "#262b25"],
    paper: ["#fffdf8", "#30362d"],
    paperAlt: ["#ede8de", "#3a4137"],
    sidebar: ["#272a24", "#1c201b"],
    sidebarAlt: ["#34392f", "#2c332a"],
    sidebarInk: ["#f4f1e8", "#f0eee6"],
    sidebarMuted: ["#bfc5b7", "#b7bdb0"],
    ink: ["#262b25", "#f0eee6"],
    muted: ["#5e675c", "#b8bdb1"],
    faint: ["#737c6f", "#98a091"],
    line: ["#d8d3c7", "#485045"],
    accent: ["#854127", "#e3a17f"],
    accentInk: ["#ffffff", "#2a1b14"],
    accentSoft: ["#f0dcd0", "#4b352b"],
    brand: ["#d55c2c", "#f08a58"],
    brandOnSidebar: ["#f0a07d", "#f0a07d"],
    brandInk: ["#ffffff", "#2b170f"],
    badgeInk: ["#ffffff", "#2b1513"],
    success: ["#35644b", "#a9d5b1"],
    successSoft: ["#e0ebdd", "#304536"],
    danger: ["#b42318", "#ff9b96"],
    warning: ["#8a5a12", "#e6c179"],
    info: ["#3d6391", "#a8c8e8"],
    selection: ["#e8e2d4", "#414a3c"],
    selectionInk: ["#262b25", "#f0eee6"],
    hover: ["#eae5db", "#363e34"],
    focus: ["#a24b25", "#f4c5a8"],
};

describe("Clinical Folio color foundation", () => {
    it.each(Object.entries(folioPairs))(
        "registers folio.%s with light and dark values",
        (role, [light, dark]) => {
            const token = tokens.folio[role];
            expect(token.value.base).toBe(light);
            expect(token.value._dark).toBe(dark);
        },
    );

    it("exposes concrete Folio values for non-CSS consumers", () => {
        expect(folioColors.light.canvas).toBe("#f3f0e9");
        expect(folioColors.dark.canvas).toBe("#262b25");
        expect(folioColors.light.sidebar).toBe("#272a24");
        expect(folioColors.dark.sidebar).toBe("#1c201b");
    });

    it("preserves overloaded legacy aliases during the foundation phase", () => {
        expect(tokens.accent.value.base).toBe("#179299");
        expect(tokens.accent.value._dark).toBe("#8bd5ca");
        expect(tokens.brand.value.base).toBe("#fe640b");
        expect(tokens.brand.value._dark).toBe("#f5a97f");
        expect(colors.light.sidebar.background).toBe("#232634");
        expect(colors.dark.sidebar.background).toBe("#1e2030");
    });

    it("registers the Folio overlay shadow and radius scale", () => {
        expect(folioShadowTokens.overlay.value.base).toBe(
            "0 12px 32px rgba(58, 42, 25, 0.08)",
        );
        expect(folioShadowTokens.overlay.value._dark).toBe(
            "0 16px 36px rgba(0, 0, 0, 0.28)",
        );
        expect(folioRadiusTokens.folioControl.value).toBe("4px");
        expect(folioRadiusTokens.folioPanel.value).toBe("7px");
        expect(folioRadiusTokens.folioOverlay.value).toBe("10px");
    });
});
