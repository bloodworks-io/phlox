// Styles for the application's scrollbars
import { folioColors } from "../colors";

const scrollbarStyles = (props) => {
    const c = folioColors[props.colorMode];
    return {
        ".custom-scrollbar": {
            scrollbarWidth: "thin",
            scrollbarColor: `${c.faint}B3 transparent`,
        },
        ".custom-scrollbar::-webkit-scrollbar": {
            width: "6px",
        },
        ".custom-scrollbar::-webkit-scrollbar-track": {
            background: "transparent",
        },
        ".custom-scrollbar::-webkit-scrollbar-thumb": {
            backgroundColor: `${c.faint}B3`,
            borderRadius: "6px",
            border: `none`,
        },

        // Narrow 4px variant for compact floating surfaces (live agent,
        // transcript popovers).
        ".slim-scrollbar": {
            scrollbarWidth: "thin",
            scrollbarColor: `${c.faint} transparent`,
        },
        ".slim-scrollbar::-webkit-scrollbar": {
            width: "4px",
        },
        ".slim-scrollbar::-webkit-scrollbar-track": {
            background: "transparent",
        },
        ".slim-scrollbar::-webkit-scrollbar-thumb": {
            backgroundColor: c.faint,
            borderRadius: "24px",
            border: "none",
        },

        // Sidebar overlay scrollbar: the sidebar stays dark in both modes,
        // so its thumb derives from the Folio sidebar muted ink.
        ".sidebar-scroll-overlay": {
            scrollbarWidth: "thin",
            scrollbarColor: `${c.sidebarMuted}40 transparent`,
        },
        ".sidebar-scroll-overlay:hover": {
            scrollbarColor: `${c.sidebarMuted}B3 transparent`,
        },
        ".sidebar-scroll-overlay::-webkit-scrollbar": {
            width: "8px",
        },
        ".sidebar-scroll-overlay::-webkit-scrollbar-track": {
            background: "transparent",
        },
        ".sidebar-scroll-overlay::-webkit-scrollbar-thumb": {
            backgroundColor: `${c.sidebarMuted}40`,
            borderRadius: "8px",
            border: "none",
        },
        ".sidebar-scroll-overlay:hover::-webkit-scrollbar-thumb": {
            backgroundColor: `${c.sidebarMuted}B3`,
        },
    };
};

const _lo = scrollbarStyles({ colorMode: "light" });
const _do = scrollbarStyles({ colorMode: "dark" });
export const scrollbarGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    scrollbarGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
