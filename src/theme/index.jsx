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

const lightGlobal = styles.global({ colorMode: "light" });
const darkGlobal = styles.global({ colorMode: "dark" });

const globalCss = {};
for (const selector of Object.keys(lightGlobal)) {
  globalCss[selector] = {
    _light: lightGlobal[selector],
    _dark: darkGlobal[selector],
  };
}

// TODO (Phase 2b): port colors → semantic tokens, and the v2 Alert/Button
// styleConfigs (./components) → defineSlotRecipe/defineRecipe, so `variant=
// "primary"|"secondary"|"icon"` Buttons and the Alert restyle work. For now the
// className-based global styling carries the app; v3 defaults fill the rest.
export const system = createSystem(defaultConfig, { globalCss });

export default system;
