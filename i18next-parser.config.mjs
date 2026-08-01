/**
 * i18next-parser config.
 *
 * Extracts t('...') keys from the source into src/locales/$LOCALE/$NAMESPACE.json.
 * Run with: npm run i18n
 *
 * keepRemoved preserves hand-written keys (and keys not yet wired up) so the
 * catalog is never pruned by extraction. English is the reference catalog; add
 * locales here as their translations land.
 */
export default {
    input: ["src/**/*.{jsx,tsx,ts,js}"],
    output: "src/locales/$LOCALE/$NAMESPACE.json",
    locales: ["en"],
    defaultLocale: "en",
    defaultNamespace: "common",
    sort: true,
    createOldCatalogs: false,
    keepRemoved: true,
    indentation: 4,
    keySeparator: ".",
    nsSeparator: ":",
    pluralSeparator: "_",
};
