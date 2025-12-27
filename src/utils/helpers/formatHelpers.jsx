// Utility functions for formatting names and dates
export const formatCollectionName = (name) => {
    return name
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const formatPatientName = (name) => {
    const nameParts = name.split(", ");
    const firstNameInitial = nameParts[1] ? nameParts[1][0] : "";
    const lastName = nameParts[0];
    return `${firstNameInitial}. ${lastName}`;
};

export const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};
