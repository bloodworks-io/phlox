/**
 * Boot-time language storage.
 *
 * The user's preferred language lives in the encrypted database (user_settings),
 * which isn't open during the splash/encryption screens. We mirror it into
 * localStorage so the UI can render in the correct language from the very first
 * paint, then sync back to i18n once the app boots and settings are fetched.
 */

const STORAGE_KEY = "preferred_language";

/**
 * Get the language stored at boot, before the encrypted DB is available.
 * Falls back to "en".
 */
export const getStoredLanguage = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) || "en";
    } catch {
        return "en";
    }
};

/**
 * Persist the preferred language to localStorage and apply it to i18n.
 * Called when user settings are loaded/saved.
 */
export const setStoredLanguage = (language) => {
    const lang = language || "en";
    try {
        localStorage.setItem(STORAGE_KEY, lang);
    } catch {
        // ignore storage failures
    }
};
