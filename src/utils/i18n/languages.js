/**
 * Language option lists.
 *
 *  - UI_LANGUAGES: locales that have a translation catalog. Drives the
 *    application-interface language. Currently only English; others are added
 *    here as their `src/locales/<code>/` catalogs land.
 *  - PREFERRED_LANGUAGE_OPTIONS: the clinic/output language a user can select
 *    as their `preferred_language`. This is broader than UI translations because
 *    it drives transcription and LLM output language, which
 *    can run in a language even when the UI is still English. Includes the 25
 *    European languages supported by the bundled Parakeet TDT v3 model plus
 *    common non-European languages for remote (OpenAI-Whisper-compatible) users.
 */

// Locales with a UI translation catalog.
export const UI_LANGUAGES = [{ code: "en", name: "English", native: "English" }];

// The parakeet-tdt-0.6b-v3 multilingual model's 25 supported European languages.
const PARAKEET_EU_LANGUAGES = [
    { code: "bg", name: "Bulgarian", native: "Български" },
    { code: "hr", name: "Croatian", native: "Hrvatski" },
    { code: "cs", name: "Czech", native: "Čeština" },
    { code: "da", name: "Danish", native: "Dansk" },
    { code: "nl", name: "Dutch", native: "Nederlands" },
    { code: "en", name: "English", native: "English" },
    { code: "et", name: "Estonian", native: "Eesti" },
    { code: "fi", name: "Finnish", native: "Suomi" },
    { code: "fr", name: "French", native: "Français" },
    { code: "de", name: "German", native: "Deutsch" },
    { code: "el", name: "Greek", native: "Ελληνικά" },
    { code: "hu", name: "Hungarian", native: "Magyar" },
    { code: "it", name: "Italian", native: "Italiano" },
    { code: "lv", name: "Latvian", native: "Latviešu" },
    { code: "lt", name: "Lithuanian", native: "Lietuvių" },
    { code: "mt", name: "Maltese", native: "Malti" },
    { code: "pl", name: "Polish", native: "Polski" },
    { code: "pt", name: "Portuguese", native: "Português" },
    { code: "ro", name: "Romanian", native: "Română" },
    { code: "sk", name: "Slovak", native: "Slovenčina" },
    { code: "sl", name: "Slovenian", native: "Slovenščina" },
    { code: "es", name: "Spanish", native: "Español" },
    { code: "sv", name: "Swedish", native: "Svenska" },
    { code: "ru", name: "Russian", native: "Русский" },
    { code: "uk", name: "Ukrainian", native: "Українська" },
];

// Common non-European languages available to remote (Whisper-compatible) users.
const EXTRA_REMOTE_LANGUAGES = [
    { code: "ar", name: "Arabic", native: "العربية" },
    { code: "zh", name: "Chinese", native: "中文" },
    { code: "ja", name: "Japanese", native: "日本語" },
    { code: "ko", name: "Korean", native: "한국어" },
    { code: "hi", name: "Hindi", native: "हिन्दी" },
    { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
    { code: "tr", name: "Turkish", native: "Türkçe" },
    { code: "he", name: "Hebrew", native: "עברית" },
    { code: "th", name: "Thai", native: "ไทย" },
    { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
];

// All languages selectable as the clinic/output language, sorted by English name.
export const PREFERRED_LANGUAGE_OPTIONS = [...PARAKEET_EU_LANGUAGES, ...EXTRA_REMOTE_LANGUAGES].sort(
    (a, b) => a.name.localeCompare(b.name),
);

export const getLanguageName = (code) =>
    PREFERRED_LANGUAGE_OPTIONS.find((l) => l.code === code)?.name || code;
