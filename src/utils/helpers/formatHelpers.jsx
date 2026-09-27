import i18n from "@/i18n";

export const formatCollectionName = (name) => name;

// Resolve a locale from the active i18n language (e.g. "en" -> "en-US").
export const getLocale = () =>
    i18n.language ? i18n.language.replace("_", "-") : "en-US";

export const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString(getLocale(), {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};
