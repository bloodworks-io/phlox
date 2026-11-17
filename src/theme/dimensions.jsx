// Layout dimensions — single source of truth for sidebar geometry.
export const SIDEBAR = {
    width: "220px",
    collapsedWidth: "80px",
};

export const sidebarWidth = (collapsed) =>
    collapsed ? SIDEBAR.collapsedWidth : SIDEBAR.width;
