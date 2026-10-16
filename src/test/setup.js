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

// jsdom omits ResizeObserver; floating-ui/zag positioning calls it when
// popovers and tooltips open.
if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}
