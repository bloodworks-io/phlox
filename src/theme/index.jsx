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

// One-shot mount animations
globalCss[".anim-fade-slide-up"] = {
    animation:
        "phloxFadeSlideUp 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
};
globalCss[".anim-fade-slide-right"] = {
    animation: "phloxFadeSlideRight 0.4s ease-out both",
};
globalCss[".anim-fade-scale"] = {
    animation:
        "phloxFadeScaleIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
};
globalCss[".anim-emerge-spring"] = {
    animation:
        "phloxEmergeSpring 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) both",
};

// Staggered entrance
globalCss[".anim-stagger > *"] = {
    animation:
        "phloxFadeSlideUp 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
};
for (let i = 1; i <= 8; i++) {
    globalCss[`.anim-stagger > *:nth-child(${i})`] = {
        animationDelay: `${i * 80}ms`,
    };
}

export const system = createSystem(defaultConfig, {
    globalCss,
    theme: {
        keyframes: {
            phloxFadeSlideUp: {
                from: { opacity: "0", transform: "translateY(20px)" },
                to: { opacity: "1", transform: "translateY(0)" },
            },
            phloxFadeSlideRight: {
                from: { opacity: "0", transform: "translateX(50px)" },
                to: { opacity: "1", transform: "translateX(0)" },
            },
            phloxFadeScaleIn: {
                from: { opacity: "0", transform: "scale(0.9)" },
                to: { opacity: "1", transform: "scale(1)" },
            },
            phloxEmergeSpring: {
                from: {
                    opacity: "0",
                    transform: "scale(0.8) translateX(20px)",
                },
                to: {
                    opacity: "1",
                    transform: "scale(1) translateX(0)",
                },
            },
        },
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
