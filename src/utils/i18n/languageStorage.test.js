import { afterEach, describe, expect, it, vi } from "vitest";
import { getStoredLanguage, setStoredLanguage } from "./languageStorage";

// Node ships an experimental `localStorage` global that shadows jsdom's, so
// tests stub their own in-memory implementation.
const createLocalStorageMock = () => {
    const store = new Map();
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
};

describe("getStoredLanguage", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('defaults to "en" when nothing is stored', () => {
        vi.stubGlobal("localStorage", createLocalStorageMock());
        expect(getStoredLanguage()).toBe("en");
    });

    it("returns the stored language", () => {
        vi.stubGlobal("localStorage", createLocalStorageMock());
        setStoredLanguage("pt");
        expect(getStoredLanguage()).toBe("pt");
    });

    it('falls back to "en" when localStorage access throws', () => {
        const storage = createLocalStorageMock();
        vi.spyOn(storage, "getItem").mockImplementation(() => {
            throw new Error("denied");
        });
        vi.stubGlobal("localStorage", storage);
        expect(getStoredLanguage()).toBe("en");
    });
});

describe("setStoredLanguage", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("persists the given language", () => {
        const storage = createLocalStorageMock();
        vi.stubGlobal("localStorage", storage);
        setStoredLanguage("de");
        expect(storage.getItem("preferred_language")).toBe("de");
    });

    it('defaults a falsy language to "en"', () => {
        const storage = createLocalStorageMock();
        vi.stubGlobal("localStorage", storage);
        setStoredLanguage("");
        expect(storage.getItem("preferred_language")).toBe("en");
        setStoredLanguage(null);
        expect(storage.getItem("preferred_language")).toBe("en");
    });

    it("swallows storage failures instead of throwing", () => {
        const storage = createLocalStorageMock();
        const spy = vi.spyOn(storage, "setItem").mockImplementation(() => {
            throw new Error("quota exceeded");
        });
        vi.stubGlobal("localStorage", storage);
        expect(() => setStoredLanguage("fr")).not.toThrow();
        expect(spy).toHaveBeenCalled();
    });
});
