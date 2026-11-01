// Muted, deterministic Clinical Folio avatar hues. White initials retain at
// least 4.5:1 contrast on every background while preserving the original
// categorical order and hash assignment.
export const FOLIO_AVATAR_COLORS = [
    "#7e746e",
    "#7d6a67",
    "#7f6778",
    "#6c5b79",
    "#7a4f4c",
    "#7b5957",
    "#7d5c46",
    "#796e52",
    "#5c724f",
    "#4c6e67",
    "#567274",
    "#4d6b74",
    "#51617c",
    "#65687e",
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
