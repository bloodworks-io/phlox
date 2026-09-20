import "@testing-library/jest-dom/vitest";

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
