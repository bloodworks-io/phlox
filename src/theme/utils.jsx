// Utility functions for handling colors
export function darkenColor(hexColor, amount = 0.1) {
    if (hexColor.startsWith("whiteAlpha")) {
        return `whiteAlpha.700`;
    }
    const hex = hexColor.replace("#", "");
    const bigint = parseInt(hex, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    r = Math.max(0, Math.min(255, Math.round(r * (1 - amount))));
    g = Math.max(0, Math.min(255, Math.round(g * (1 - amount))));
    b = Math.max(0, Math.min(255, Math.round(b * (1 - amount))));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function lightenColor(hexColor, amount = 0.1) {
    const hex = hexColor.replace("#", "");
    const bigint = parseInt(hex, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    r = Math.max(0, Math.min(255, Math.round(r + (255 - r) * amount)));
    g = Math.max(0, Math.min(255, Math.round(g + (255 - g) * amount)));
    b = Math.max(0, Math.min(255, Math.round(b + (255 - b) * amount)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
