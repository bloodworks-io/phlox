import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./apiConfig", () => ({ isTauri: vi.fn() }));

// Node ships an experimental `localStorage` global that shadows jsdom's, so
// each test stubs a fresh in-memory implementation. featureFlags caches state
// at module scope, so each test also re-imports a fresh module.
const createLocalStorageMock = () => {
    const store = new Map();
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
};

const load = async (storage) => {
    vi.stubGlobal("localStorage", storage);
    const flags = await import("./featureFlags");
    const { isTauri } = await import("./apiConfig");
    return { flags, isTauri };
};

describe("featureFlags", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it("always enables chat and PDF forms", async () => {
        const { flags } = await load(createLocalStorageMock());
        expect(flags.isChatEnabled()).toBe(true);
        expect(flags.isPdfFormsEnabled()).toBe(true);
    });

    it("enables RAG on web/docker regardless of embedding state", async () => {
        const { flags, isTauri } = await load(createLocalStorageMock());
        isTauri.mockReturnValue(false);
        expect(flags.isRagEnabled()).toBe(true);
    });

    it("disables RAG on desktop until the embedding model is ready", async () => {
        const storage = createLocalStorageMock();
        const { flags, isTauri } = await load(storage);
        isTauri.mockReturnValue(true);

        expect(flags.isRagEnabled()).toBe(false);

        flags.setEmbeddingReady(true);
        expect(flags.isRagEnabled()).toBe(true);
        expect(storage.getItem("embedding-model-ready")).toBe("true");

        flags.setEmbeddingReady(false);
        expect(flags.isRagEnabled()).toBe(false);
        expect(storage.getItem("embedding-model-ready")).toBe("false");
    });

    it("restores the embedding-ready state from storage on load", async () => {
        const storage = createLocalStorageMock();
        storage.setItem("embedding-model-ready", "true");
        const { flags, isTauri } = await load(storage);
        isTauri.mockReturnValue(true);
        expect(flags.isRagEnabled()).toBe(true);
    });

    it("treats a corrupted embedding flag value as not ready", async () => {
        const storage = createLocalStorageMock();
        storage.setItem("embedding-model-ready", "yes");
        const { flags, isTauri } = await load(storage);
        isTauri.mockReturnValue(true);
        expect(flags.isRagEnabled()).toBe(false);
    });

    it("never forces the splash screen outside desktop dev", async () => {
        const { flags, isTauri } = await load(createLocalStorageMock());

        isTauri.mockReturnValue(false);
        vi.stubEnv("DEV", true);
        expect(flags.isForceSplashEnabled()).toBe(false);

        isTauri.mockReturnValue(true);
        vi.stubEnv("DEV", false);
        expect(flags.isForceSplashEnabled()).toBe(false);
    });

    it("forces the splash screen on desktop dev unless opted out", async () => {
        const { flags, isTauri } = await load(createLocalStorageMock());
        isTauri.mockReturnValue(true);
        vi.stubEnv("DEV", true);

        expect(flags.isForceSplashEnabled()).toBe(true);

        vi.stubEnv("VITE_FORCE_SPLASH", "false");
        expect(flags.isForceSplashEnabled()).toBe(false);
    });
});
