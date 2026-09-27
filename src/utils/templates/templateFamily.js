/**
 * Canonical template family/version logic — the single client-side
 * authority for how template keys encode family, fork, and version.
 *
 * Key shapes:
 *   {base}_{version}        protected original or user-created series
 *                            (phlox_01, soap_3, itp_follow-up_note_2)
 *   custom_{base}_{version}  user's fork of a protected template
 *                            (custom_phlox_1)
 *
 * Rules (must stay in sync with server.database.repositories.templates):
 *   - Forks of a protected family represent the user's customization and
 *     outrank every protected version of that family.
 *   - Versions compare numerically: phlox_10 > phlox_9 > phlox_01.
 */

export const DEFAULT_TEMPLATE_KEYS = [
    "phlox_",
    "soap_",
    "progress_",
    "consult_",
    "procedure_",
];

export const isDefaultTemplate = (templateKey) =>
    DEFAULT_TEMPLATE_KEYS.some((prefix) => templateKey?.startsWith(prefix));

export const getTemplateFamilyBase = (templateKey) => {
    if (!templateKey) return "";
    const parts = templateKey.split("_");
    if (parts[0] === "custom" && parts.length >= 3) {
        const second = parts[1];
        const rest = parts.slice(2).join("_");
        if (rest && /^\d+$/.test(rest) && isDefaultTemplate(`${second}_x`)) {
            return second;
        }
    }
    return parts[0];
};

export const getForkBase = (templateKey) => {
    if (!templateKey?.startsWith("custom_")) return null;
    const rest = templateKey.slice("custom_".length);
    for (const prefix of DEFAULT_TEMPLATE_KEYS) {
        const base = prefix.slice(0, -1);
        if (
            rest.startsWith(`${base}_`) &&
            /^\d+$/.test(rest.slice(base.length + 1))
        ) {
            return base;
        }
    }
    return null;
};

export const isCustomizedDefault = (templateKey) =>
    getForkBase(templateKey) !== null;

const versionOf = (templateKey) => {
    const parts = templateKey?.split("_") ?? [];
    return /^\d+$/.test(parts[parts.length - 1] ?? "")
        ? parseInt(parts[parts.length - 1], 10)
        : 0;
};

// Higher sorts first: forks outrank protected versions, then version number.
const familyOrderKey = (templateKey) => {
    const isFork = getForkBase(templateKey) !== null;
    return [isFork ? 1 : 0, versionOf(templateKey)];
};

export const compareFamilyOrder = (a, b) => {
    const ka = familyOrderKey(a);
    const kb = familyOrderKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    return ka[1] - kb[1];
};

export const familyMembers = (templates, templateKey) => {
    if (!Array.isArray(templates) || !templateKey) return [];
    const base = getTemplateFamilyBase(templateKey);
    return templates.filter(
        (t) =>
            t?.template_key && getTemplateFamilyBase(t.template_key) === base,
    );
};

/**
 * Latest member of the template's family: user forks win over protected
 * versions, versions compare numerically. Returns null when the family
 * has no live members.
 */
export const latestInFamily = (templates, templateKey) => {
    const members = familyMembers(templates, templateKey);
    if (members.length === 0) return null;
    return members.reduce((best, t) =>
        compareFamilyOrder(t.template_key, best.template_key) > 0 ? t : best,
    );
};
