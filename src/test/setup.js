import "@testing-library/jest-dom/vitest";
import "@/i18n";

// jsdom omits matchMedia; next-themes/Chakra color-mode call it on mount.
// (Guarded so node-environment test files can share this setup.)
if (typeof window !== "undefined" && !window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}

// This jsdom build exposes no localStorage; localBackend/db.ts needs it.
if (typeof window !== "undefined" && !window.localStorage) {
    const map = new Map();
    window.localStorage = {
        getItem: (key) => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => map.set(key, String(value)),
        removeItem: (key) => map.delete(key),
        clear: () => map.clear(),
        key: (index) => [...map.keys()][index] ?? null,
        get length() {
            return map.size;
        },
    };
}
