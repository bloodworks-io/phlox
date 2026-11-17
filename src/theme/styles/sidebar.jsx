// Shared sidebar patient-row hook. Visual properties are kept minimal because
// selection/hover state is applied inline in SidebarPatientList.
const sidebarStyles = () => ({
    ".patient-list-item": {
        color: "folio.sidebarInk !important",
        transition: "background-color 160ms ease",
    },
    ".patient-list-item.selected": {
        color: "folio.selectionInk !important",
    },
});

const _lo = sidebarStyles({ colorMode: "light" });
const _do = sidebarStyles({ colorMode: "dark" });
export const sidebarGlobalCss = {};
for (const selector of Object.keys(_lo)) {
    sidebarGlobalCss[selector] = {
        _light: _lo[selector],
        _dark: _do[selector],
    };
}
