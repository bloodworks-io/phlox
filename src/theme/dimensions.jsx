// Layout dimensions — single source of truth for sidebar geometry.
export const SIDEBAR = {
    width: "220px",
    collapsedWidth: "80px",
    // Offsets content must clear (sidebar width + Tauri insets).
    tauriOffset: "236px",
    tauriCollapsedOffset: "96px",
};

export const sidebarWidth = (collapsed) =>
    collapsed ? SIDEBAR.collapsedWidth : SIDEBAR.width;

export const sidebarOffset = (collapsed, tauri = false) =>
    collapsed
        ? tauri
            ? SIDEBAR.tauriCollapsedOffset
            : SIDEBAR.collapsedWidth
        : tauri
          ? SIDEBAR.tauriOffset
          : SIDEBAR.width;
