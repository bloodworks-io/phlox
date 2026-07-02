// Styles for the application's scrollbars
import { colors } from "../colors";

const scrollbarStyles = (props) => ({
    ".custom-scrollbar": {
        scrollbarWidth: "thin",
        scrollbarColor:
            props.colorMode === "light"
                ? `${colors.light.surface2} transparent`
                : `${colors.dark.surface2} transparent`,
    },
    ".custom-scrollbar::-webkit-scrollbar": {
        width: "6px",
    },
    ".custom-scrollbar::-webkit-scrollbar-track": {
        background: "transparent",
    },
    ".custom-scrollbar::-webkit-scrollbar-thumb": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface2}B3`
                : `${colors.dark.surface2}B3`,
        borderRadius: "6px",
        border: `none`,
    },

    ".sidebar-scroll-overlay": {
        scrollbarWidth: "thin",
        scrollbarColor:
            props.colorMode === "light"
                ? `${colors.light.surface2}40 transparent`
                : `${colors.dark.surface2}40 transparent`,
    },
    ".sidebar-scroll-overlay:hover": {
        scrollbarColor:
            props.colorMode === "light"
                ? `${colors.light.surface2}B3 transparent`
                : `${colors.dark.surface2}B3 transparent`,
    },
    ".sidebar-scroll-overlay::-webkit-scrollbar": {
        width: "8px",
    },
    ".sidebar-scroll-overlay::-webkit-scrollbar-track": {
        background: "transparent",
    },
    ".sidebar-scroll-overlay::-webkit-scrollbar-thumb": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface2}40`
                : `${colors.dark.surface2}40`,
        borderRadius: "8px",
        border: "none",
    },
    ".sidebar-scroll-overlay:hover::-webkit-scrollbar-thumb": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface2}B3`
                : `${colors.dark.surface2}B3`,
    },
});

const _lo = scrollbarStyles({ colorMode: "light" });
const _do = scrollbarStyles({ colorMode: "dark" });
export const scrollbarGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    scrollbarGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
