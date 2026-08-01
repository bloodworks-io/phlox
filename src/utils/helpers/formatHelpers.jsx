import i18n from "@/i18n";

export const formatCollectionName = (name) => name;

export const formatDate = (date) => {
    if (!date) return "";
    // Resolve a locale from the active i18n language (e.g. "en" -> "en-US").
    const locale = i18n.language ? i18n.language.replace("_", "-") : "en-US";
    return new Date(date).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};
