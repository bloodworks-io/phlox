export const getAvatarColor = (name) => {
    // Catppuccin Frappé colors
    const catppuccinColors = [
        "#f2d5cf", // Rosewater
        "#eebebe", // Flamingo
        "#f4b8e4", // Pink
        "#ca9ee6", // Mauve
        "#e78284", // Red
        "#ea999c", // Maroon
        "#ef9f76", // Peach
        "#e5c890", // Yellow
        "#a6d189", // Green
        "#81c8be", // Teal
        "#99d1db", // Sky
        "#85c1dc", // Sapphire
        "#8caaee", // Blue
        "#babbf1", // Lavender
    ];

    // Simple hash function for the name
    let hash = 0;
    if (name) {
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
    }

    // Get a consistent color from the array
    const index = Math.abs(hash) % catppuccinColors.length;
    return catppuccinColors[index];
};

export const getInitials = (name) => {
    // Check if name is in "Last, First" format
    if (name.includes(",")) {
        const [lastName, firstName] = name
            .split(",")
            .map((part) => part.trim());
        return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }

    // Fallback for "First Last" format
    const nameParts = name.split(" ");
    return nameParts.length > 1
        ? `${nameParts[0][0]}${nameParts[1][0]}`
        : nameParts[0].slice(0, 2).toUpperCase();
};
