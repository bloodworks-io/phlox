/**
 * Language option lists.
 *
 *  - UI_LANGUAGES: locales that have a translation catalog in
 *    `src/locales/<code>/`. This is the only list selectable in the UI; a
 *    language appears here only once it is fully localised. See src/i18n.js
 *    for the steps to add a locale.
 */

// Locales with a UI translation catalog.
export const UI_LANGUAGES = [{ code: "en", name: "English", native: "English" }];

export const getLanguageName = (code) =>
    UI_LANGUAGES.find((l) => l.code === code)?.name || code;
