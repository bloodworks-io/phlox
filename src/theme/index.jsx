// Entry point for the Chakra UI v3 theme.
//

import { createSystem, defaultConfig } from "@chakra-ui/react";
import { typography } from "./typography";
import { tokens as colorTokens } from "./colors";
import { buttonGlobalCss } from "./styles/button";
import { inputGlobalCss } from "./styles/input";
import { sidebarGlobalCss } from "./styles/sidebar";
import { baseGlobalCss } from "./styles/base";
import { panelGlobalCss } from "./styles/panel";
import { modalGlobalCss } from "./styles/modal";
import { floatingGlobalCss } from "./styles/floating";
import { modeSelectorGlobalCss } from "./styles/modeSelector";
import { toggleGlobalCss } from "./styles/toggle";
import { documentExplorerGlobalCss } from "./styles/documentExplorer";
import { checkboxGlobalCss } from "./styles/checkbox";
import { tabGlobalCss } from "./styles/tab";
import { scrollbarGlobalCss } from "./styles/scrollbar";
import { patientInfoGlobalCss } from "./styles/patientInfo";

const globalCss = {};

Object.assign(
    globalCss,
    baseGlobalCss,
    sidebarGlobalCss,
    panelGlobalCss,
    buttonGlobalCss,
    inputGlobalCss,
    modalGlobalCss,
    floatingGlobalCss,
    modeSelectorGlobalCss,
    toggleGlobalCss,
    documentExplorerGlobalCss,
    checkboxGlobalCss,
    tabGlobalCss,
    scrollbarGlobalCss,
    patientInfoGlobalCss,
);

globalCss[".main-bg"] = { backgroundColor: "base" };
globalCss[".flex-container"] = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "50px",
};
globalCss[".landing-items"] = {
    backgroundColor: { _light: "base", _dark: "crust" },
    color: "textSecondary !important",
    border: "none",
    fontWeight: "normal",
};
globalCss[".green-icon"] = { color: "successButton !important" };
globalCss[".red-icon"] = { color: "dangerButton !important" };
globalCss[".yellow-icon"] = { color: "secondaryButton !important" };
globalCss[".blue-icon"] = { color: "primaryButton !important" };

globalCss[".chakra-button"] = {
    fontWeight: "600 !important",
    fontSize: "16px !important",
    transition: "transform 0.1s ease, background 0.15s ease !important",
};
globalCss[".chakra-button:active"] = {
    transform: "scale(0.97)",
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
    globalCss[`.anim-stagger > *:nth-of-type(${i})`] = {
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
        semanticTokens: {
            colors: colorTokens,
        },
        slotRecipes: {
            table: {
                base: {
                    cell: {
                        fontVariantNumeric: "tabular-nums",
                    },
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
            popover: {
                base: {
                    content: {
                        "--popover-bg": "var(--chakra-colors-secondary)",
                        bg: "var(--popover-bg)",
                        border: "1px solid",
                        borderColor: "surface",
                        borderRadius: "lg",
                        color: "textPrimary",
                    },
                    header: {
                        fontSize: "sm",
                        fontWeight: "600",
                        color: "textPrimary",
                        borderBottom: "1px solid",
                        borderColor: "surface",
                        px: "3",
                        py: "2.5",
                        lineHeight: "1.2",
                    },
                    body: {
                        maxH: "300px",
                        overflowY: "auto",
                    },
                    footer: {
                        borderTop: "1px solid",
                        borderColor: "surface",
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
