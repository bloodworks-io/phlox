import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { TemplateProvider, useTemplate } from "./templateContext";

// Diagnostic suite for the template state machine. Every switching /
// persistence path in the app flows through TemplateProvider, so the
// races and fallbacks probed here are the ones users experience as
// "templates switching themselves" or "my default didn't stick".
//
// KNOWN-DEFECT tests use it.fails: they assert the correct behaviour and
// pass (flagged by vitest) once the defect is fixed.

const api = vi.hoisted(() => ({
    fetchTemplates: vi.fn(),
    getDefaultTemplate: vi.fn(),
    getTemplateByKey: vi.fn(),
    deleteTemplate: vi.fn(),
    setDefaultTemplate: vi.fn(),
    saveTemplates: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());
const init = vi.hoisted(() => ({ isInitializing: false }));

vi.mock("../api/templateApi", () => ({ templateApi: api }));
vi.mock("../helpers/apiToastContext", () => ({ useApiToast: () => toast }));
vi.mock("../context/appInit", () => ({ useAppInit: () => init }));

const deferred = () => {
    let resolve;
    const promise = new Promise((res) => (resolve = res));
    return { promise, resolve };
};

const TPL = (key, extra = {}) => ({
    template_key: key,
    template_name: key,
    ...extra,
});
const DEFAULT_KEY = "phlox_01";
const LIST = () => [TPL("phlox_01"), TPL("soap_01"), TPL("custom_gout_1")];

const renderTemplates = () =>
    renderHook(() => useTemplate(), {
        wrapper: ({ children }) => (
            <TemplateProvider>{children}</TemplateProvider>
        ),
    });

const settled = (result) =>
    waitFor(() => expect(result.current.status).toBe("succeeded"));

beforeEach(() => {
    vi.clearAllMocks();
    init.isInitializing = false;
    api.fetchTemplates.mockResolvedValue(LIST());
    api.getDefaultTemplate.mockResolvedValue({ template_key: DEFAULT_KEY });
});

describe("TemplateProvider: initialisation", () => {
    it("loads the list and selects the default from the list without a by-key fetch", async () => {
        const { result } = renderTemplates();

        await waitFor(() =>
            expect(result.current.currentTemplate?.template_key).toBe(
                DEFAULT_KEY,
            ),
        );

        expect(result.current.defaultTemplateKey).toBe(DEFAULT_KEY);
        expect(api.getTemplateByKey).not.toHaveBeenCalled();
    });

    it("defers the initial fetch while the app is initializing", async () => {
        init.isInitializing = true;
        const { result, rerender } = renderTemplates();

        expect(api.fetchTemplates).not.toHaveBeenCalled();

        init.isInitializing = false;
        rerender();

        await waitFor(() =>
            expect(result.current.currentTemplate?.template_key).toBe(
                DEFAULT_KEY,
            ),
        );
        expect(api.fetchTemplates).toHaveBeenCalledTimes(1);
    });

    it("degrades gracefully when the default pointer references a missing template", async () => {
        api.fetchTemplates.mockResolvedValue([
            TPL("soap_01"),
            TPL("custom_gout_1"),
        ]);
        const { result } = renderTemplates();

        await waitFor(() =>
            expect(result.current.currentTemplate?.template_key).toBe("soap_01"),
        );

        expect(result.current.status).toBe("succeeded");
        expect(result.current.error).toBeNull();
        expect(result.current.defaultTemplate).toBeNull();
        expect(api.getTemplateByKey).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalledTimes(1); // warned once, not per refresh
    });
});

describe("TemplateProvider: switching", () => {
    it("selects a listed template with no network call", async () => {
        const { result } = renderTemplates();
        await settled(result);

        await act(() => result.current.selectTemplate("soap_01"));

        expect(result.current.currentTemplate?.template_key).toBe("soap_01");
        expect(api.getTemplateByKey).not.toHaveBeenCalled();
    });

    it("fetches unknown keys and keeps the prior selection when that fetch fails", async () => {
        const { result } = renderTemplates();
        await settled(result);

        api.getTemplateByKey.mockResolvedValueOnce(TPL("hidden_1"));
        await act(() => result.current.selectTemplate("hidden_1"));
        expect(result.current.currentTemplate?.template_key).toBe("hidden_1");

        api.getTemplateByKey.mockRejectedValueOnce(new Error("404"));
        await act(() => result.current.selectTemplate("gone_1"));

        expect(result.current.currentTemplate?.template_key).toBe("hidden_1");
        expect(result.current.error).toBe("404");
        expect(toast).toHaveBeenCalled();
    });

    it("keeps the newest selection when an older fetch resolves last", async () => {
        const { result } = renderTemplates();
        await settled(result);

        const slow = deferred();
        const fast = deferred();
        api.getTemplateByKey.mockReturnValueOnce(slow.promise);
        api.getTemplateByKey.mockReturnValueOnce(fast.promise);

        let p1;
        let p2;
        act(() => {
            p1 = result.current.selectTemplate("slow_1");
            p2 = result.current.selectTemplate("fast_1");
        });
        await act(async () => {
            fast.resolve(TPL("fast_1"));
            await p2;
        });
        await act(async () => {
            slow.resolve(TPL("slow_1"));
            await p1;
        });

        expect(result.current.currentTemplate?.template_key).toBe("fast_1");
    });
});

describe("TemplateProvider: default pointer persistence", () => {
    it("persists a new default and selects it", async () => {
        const { result } = renderTemplates();
        await settled(result);
        api.setDefaultTemplate.mockResolvedValueOnce(undefined);

        await act(() => result.current.setDefaultTemplate("soap_01"));

        expect(api.setDefaultTemplate).toHaveBeenCalledWith("soap_01");
        expect(result.current.defaultTemplateKey).toBe("soap_01");
        expect(result.current.currentTemplate?.template_key).toBe("soap_01");
    });

    it("failure to persist keeps the old pointer and reports the error", async () => {
        const { result } = renderTemplates();
        await settled(result);
        api.setDefaultTemplate.mockRejectedValueOnce(new Error("boom"));

        const outcome = await act(() =>
            result.current.setDefaultTemplate("soap_01"),
        );

        expect(result.current.defaultTemplateKey).toBe(DEFAULT_KEY);
        expect(outcome).toBe(false);
        expect(toast).toHaveBeenCalled();
    });
});

describe("TemplateProvider: saving", () => {
    it("follows a renamed key from updated_keys after save", async () => {
        const { result } = renderTemplates();
        await settled(result);
        await act(() => result.current.selectTemplate("soap_01"));

        api.saveTemplates.mockResolvedValueOnce({
            updated_keys: { soap_01: "custom_soap_1" },
        });
        api.fetchTemplates.mockResolvedValueOnce([
            TPL("phlox_01"),
            TPL("custom_soap_1"),
            TPL("custom_gout_1"),
        ]);
        // saveTemplate → refreshTemplates → selectTemplate run in one act
        // scope, so stateRef still holds the pre-refresh list and the new
        // key resolves via a by-key fetch (extra round trip, but correct).
        api.getTemplateByKey.mockResolvedValueOnce(TPL("custom_soap_1"));

        await act(() => result.current.saveTemplate(TPL("soap_01")));

        expect(api.saveTemplates).toHaveBeenCalledWith([TPL("soap_01")]);
        expect(result.current.currentTemplate?.template_key).toBe(
            "custom_soap_1",
        );
    });

    // Characterisation: when a save drops the selected key from the list
    // but the response omits an updated_keys mapping, refresh silently
    // falls back to the default. Documents the drift risk until the
    // server contract guarantees updated_keys.
    it("falls back to the default when a save drops the key without updated_keys", async () => {
        const { result } = renderTemplates();
        await settled(result);
        await act(() => result.current.selectTemplate("soap_01"));

        api.saveTemplates.mockResolvedValueOnce({ updated_keys: {} });
        api.fetchTemplates.mockResolvedValueOnce([
            TPL("phlox_01"),
            TPL("custom_gout_1"),
        ]);

        await act(() => result.current.saveTemplate(TPL("soap_01")));

        expect(result.current.currentTemplate?.template_key).toBe(DEFAULT_KEY);
    });
});

describe("TemplateProvider: refresh", () => {
    it("keeps the current selection when it still exists", async () => {
        const { result } = renderTemplates();
        await settled(result);
        await act(() => result.current.selectTemplate("soap_01"));

        await act(() => result.current.refreshTemplates());

        expect(result.current.currentTemplate?.template_key).toBe("soap_01");
    });

    it("falls back to the default without a by-key fetch when the current template disappears", async () => {
        const { result } = renderTemplates();
        await settled(result);
        await act(() => result.current.selectTemplate("custom_gout_1"));

        api.fetchTemplates.mockResolvedValueOnce([
            TPL("phlox_01"),
            TPL("soap_01"),
        ]);
        await act(() => result.current.refreshTemplates());

        expect(result.current.currentTemplate?.template_key).toBe(DEFAULT_KEY);
        expect(api.getTemplateByKey).not.toHaveBeenCalled();
    });

    it("keeps the live selection when the default pointer dangles", async () => {
        const { result } = renderTemplates();
        await settled(result);
        await act(() => result.current.selectTemplate("soap_01"));

        // Default template (phlox_01) gone from the list on next refresh.
        api.fetchTemplates.mockResolvedValueOnce([
            TPL("soap_01"),
            TPL("custom_gout_1"),
        ]);
        await act(() => result.current.refreshTemplates());

        expect(result.current.currentTemplate?.template_key).toBe("soap_01");
        expect(result.current.defaultTemplate).toBeNull();
        expect(api.getTemplateByKey).not.toHaveBeenCalled();
    });
});

describe("TemplateProvider: deletion", () => {
    it("refuses to delete protected templates", async () => {
        const { result } = renderTemplates();
        await settled(result);

        const ok = await act(() => result.current.deleteTemplate("phlox_01"));

        expect(ok).toBe(false);
        expect(api.deleteTemplate).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalled();
    });

    it("deletes a custom template and falls back to the default selection", async () => {
        const { result } = renderTemplates();
        await settled(result);
        await act(() => result.current.selectTemplate("custom_gout_1"));

        api.deleteTemplate.mockResolvedValueOnce(true);
        api.fetchTemplates.mockResolvedValueOnce([
            TPL("phlox_01"),
            TPL("soap_01"),
        ]);

        const ok = await act(() =>
            result.current.deleteTemplate("custom_gout_1"),
        );

        expect(ok).toBe(true);
        expect(result.current.currentTemplate?.template_key).toBe(DEFAULT_KEY);
    });
});
