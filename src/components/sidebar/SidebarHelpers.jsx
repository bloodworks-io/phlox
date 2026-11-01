// Deterministic Clinical Folio avatar hues, pre-mixed 62% hue / 38% #20251f
// exactly as the design portfolio renders them. White initials retain at
// least 4.5:1 contrast on every background.
export const FOLIO_AVATAR_COLORS = [
    "#745752",
    "#516552",
    "#6C6246",
    "#5A5464",
    "#4B6466",
    "#705D4C",
    "#7E6059",
    "#5A6F56",
    "#83734C",
    "#55726F",
    "#6C6476",
    "#504039",
    "#38483B",
    "#7E6752",
];

export const getAvatarColor = (name) => {
    // Simple hash function for the name
    let hash = 0;
    if (name) {
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
    }

    // Get a consistent color from the array
    const index = Math.abs(hash) % FOLIO_AVATAR_COLORS.length;
    return FOLIO_AVATAR_COLORS[index];
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
