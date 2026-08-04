/**
 * i18next-cli config.
 *
 * Extracts t('...') keys from the source into src/locales/{{language}}/{{namespace}}.json.
 * Run with: npm run i18n
 *
 * removeUnusedKeys: false preserves hand-written keys (and keys not yet wired up)
 * so the catalog is never pruned by extraction. English is the reference catalog;
 * add locales here as their translations land.
 */
import { defineConfig } from "i18next-cli";

export default defineConfig({
    locales: ["en"],
    extract: {
        input: ["src/**/*.{jsx,tsx,ts,js}"],
        output: "src/locales/{{language}}/{{namespace}}.json",
        defaultNS: "common",
        primaryLanguage: "en",
        removeUnusedKeys: false,
        sort: true,
        indentation: 4,
        keySeparator: ".",
        nsSeparator: ":",
        pluralSeparator: "_",
    },
});
