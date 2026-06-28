// Entry point for the Chakra UI v3 theme.
//
// The v2 global styles (./styles — 14 modules) are functions of
// (props) => ({ ... }) keyed off `props.colorMode`, reading `colors.light.X` /
// `colors.dark.X` (plain hex). v3's `globalCss` is static (no colorMode prop),
// so we evaluate both color modes up front and attach each selector's light /
// dark values as `_light` / `_dark` variants — v3 applies the active color mode
// automatically. This reuses all 14 style modules verbatim; no per-rule rewrite.
import { createSystem, defaultConfig } from "@chakra-ui/react";
import { styles } from "./styles";
import { typography } from "./typography";

const lightGlobal = styles.global({ colorMode: "light" });
const darkGlobal = styles.global({ colorMode: "dark" });

const globalCss = {};
for (const selector of Object.keys(lightGlobal)) {
    globalCss[selector] = {
        _light: lightGlobal[selector],
        _dark: darkGlobal[selector],
    };
}

// Heavier button label weight (v3 Button base is "medium"/500; v2 was heavier).
globalCss[".chakra-button"] = {
    fontWeight: "600 !important",
    fontSize: "16px !important",
};

// Slightly smaller icons inside buttons (rendered as <svg> children in v3).
globalCss[".chakra-button svg"] = {
    width: "0.95em !important",
    height: "0.95em !important",
};

export const system = createSystem(defaultConfig, {
    globalCss,
    theme: {
        tokens: {
            fonts: {
                heading: { value: typography.fonts.heading },
                body: { value: typography.fonts.body },
            },
        },
        slotRecipes: {
            table: {
                base: {
                    columnHeader: {
                        fontSize: "12px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        lineHeight: "16px",
                        borderBottomWidth: "1px",
                        _light: {
                            color: "#4A5568",
                            borderBottomColor: "#EDF2F7",
                        },
                        _dark: {
                            color: "#a0aec0",
                            borderBottomColor: "#2D3748",
                        },
                    },
                },
                variants: {
                    size: {
                        md: { root: { textStyle: "md" } },
                    },
                },
            },
            tabs: {
                base: {
                    content: {
                        _horizontal: { px: "4", pb: "4" },
                    },
                },
                variants: {
                    variant: {
                        enclosed: {
                            list: { bg: "transparent", padding: "0" },
                            trigger: {
                                _selected: { shadow: "none" },
                            },
                        },
                    },
                },
            },
        },
        recipes: {
            input: {
                variants: {
                    variant: {
                        unstyled: {
                            bg: "transparent",
                            borderWidth: "0",
                            boxShadow: "none",
                        },
                    },
                },
            },
            textarea: {
                variants: {
                    variant: {
                        unstyled: {
                            bg: "transparent",
                            borderWidth: "0",
                            boxShadow: "none",
                        },
                    },
                },
            },
        },
    },
});

export default system;
