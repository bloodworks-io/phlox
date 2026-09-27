import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { getStoredLanguage, setStoredLanguage } from "./utils/i18n/languageStorage";
import enCommon from "./locales/en/common.json";

/**
 * To add a UI locale:
 *   1. Create src/locales/<code>/common.json.
 *   2. Import it here and add to `resources` + `supportedLngs`.
 *   3. Add the locale to UI_LANGUAGES in utils/i18n/languages.js.
 */
i18n.use(initReactI18next).init({
    resources: {
        en: { common: enCommon },
    },
    lng: getStoredLanguage(),
    fallbackLng: "en",
    supportedLngs: ["en"],
    defaultNS: "common",
    ns: ["common"],
    interpolation: {
        escapeValue: false, // React escapes by default
    },
    returnNull: false,
    parseMissingKeyHandler: (key) => {
        if (import.meta.env.DEV) {
            console.warn(`[i18n] missing key: ${key}`);
        }
        return key;
    },
});

// For non-React contexts (api modules, plain helpers). Inside components and
// hooks, prefer useTranslation().
export const t = (key, options) => i18n.t(key, options);

export const syncLanguage = (language) => {
    const lang = language || "en";
    setStoredLanguage(lang);
    void i18n.changeLanguage(lang);
};

export default i18n;
