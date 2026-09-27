import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePatientTemplate } from "./usePatientTemplate";
import { TemplateProvider } from "../templates/templateContext";

// Diagnostic suite for encounter-level template resolution: which template
// applies when viewing/creating a patient encounter, and how selection
// persists across template retirement (family upgrades).
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
const warn = vi.hoisted(() => vi.fn());
const init = vi.hoisted(() => ({ isInitializing: false }));

vi.mock("@/utils/api/templateApi", () => ({ templateApi: api }));
vi.mock("@/utils/helpers/apiToastContext", () => ({ useApiToast: () => toast }));
vi.mock("@/utils/context/appInit", () => ({ useAppInit: () => init }));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: toast },
}));
vi.mock("@/utils/hooks/UseToastMessage", () => ({
    useToastMessage: () => ({ showWarningToast: warn }),
}));

const TPL = (key, extra = {}) => ({
    template_key: key,
    template_name: key,
    ...extra,
});
const DEFAULT_KEY = "phlox_01";
const LIST = () => [
    TPL("phlox_01", {
        fields: [{ field_key: "subjectives" }, { field_key: "assessment" }],
    }),
    TPL("soap_01"),
    TPL("phlox_3"),
    TPL("custom_phlox_1"),
    TPL("custom_gout_1"),
];

const renderPatient = (overrides = {}) => {
    const holder = {
        patient: { template_key: null, ...overrides.patient },
    };
    const setPatient = vi.fn((updater) => {
        holder.patient =
            typeof updater === "function" ? updater(holder.patient) : updater;
    });
    const utils = renderHook(
        () =>
            usePatientTemplate({
                patient: holder.patient,
                setPatient,
                isNewPatient: overrides.isNewPatient ?? true,
                isSearchedPatient: overrides.isSearchedPatient ?? false,
                initialPatient: overrides.initialPatient ?? null,
                isSearchLoading: false,
            }),
        {
            wrapper: ({ children }) => (
                <TemplateProvider>{children}</TemplateProvider>
            ),
        },
    );
    return { ...utils, holder, setPatient };
};

beforeEach(() => {
    vi.resetAllMocks();
    init.isInitializing = false;
    api.fetchTemplates.mockResolvedValue(LIST());
    api.getDefaultTemplate.mockResolvedValue({ template_key: DEFAULT_KEY });
    // stateRef in TemplateProvider lags one commit, so selections fired
    // from effects often miss the list and resolve via a by-key fetch.
    // Serve any key generically (with fields, for the mapping test).
    api.getTemplateByKey.mockImplementation(async (key) =>
        TPL(key, {
            fields: [{ field_key: "subjectives" }, { field_key: "assessment" }],
        }),
    );
});

describe("usePatientTemplate: new encounters", () => {
    it("applies the default template and pins it on the encounter", async () => {
        const { result, holder } = renderPatient();

        await waitFor(() =>
            expect(result.current.currentTemplate?.template_key).toBe(
                DEFAULT_KEY,
            ),
        );
        await waitFor(() =>
            expect(holder.patient.template_key).toBe(DEFAULT_KEY),
        );
    });

    it("uses the first live template for a new patient when the default dangles", async () => {
        api.getDefaultTemplate.mockResolvedValue({ template_key: "gone_1" });
        api.fetchTemplates.mockResolvedValue([
            TPL("custom_gout_1"),
            TPL("phlox_01"),
        ]);
        const { result, holder } = renderPatient();

        await waitFor(() =>
            expect(result.current.currentTemplate?.template_key).toBe(
                "custom_gout_1",
            ),
        );
        await waitFor(() =>
            expect(holder.patient.template_key).toBe("custom_gout_1"),
        );
    });
});

describe("usePatientTemplate: historical encounters", () => {
    it("pins the saved template, resolving soft-deleted keys", async () => {
        const { result } = renderPatient({
            patient: { template_key: "phlox_2", isNewEncounter: false },
            isNewPatient: false,
        });

        await waitFor(() =>
            expect(result.current.currentTemplate?.template_key).toBe("phlox_2"),
        );
        expect(api.getTemplateByKey).toHaveBeenCalledWith("phlox_2", {
            includeDeleted: true,
        });
    });

    it("maps historical data onto the current template's fields", async () => {
        const { holder } = renderPatient({
            patient: { template_key: "phlox_2", isNewEncounter: false },
            isNewPatient: false,
            initialPatient: {
                template_data: { subjectives: "old text", dropped: "x" },
            },
        });

        await waitFor(() =>
            expect(holder.patient.template_data).toEqual({
                subjectives: "old text",
                assessment: "",
            }),
        );
        expect(holder.patient.isHistorical).toBe(true);
    });
});

describe("usePatientTemplate: returning patients", () => {
    it("selects the patient's still-active template", async () => {
        const { result } = renderPatient({
            patient: { template_key: "soap_01", isNewEncounter: true },
            isNewPatient: false,
        });

        await waitFor(() =>
            expect(result.current.currentTemplate?.template_key).toBe(
                "soap_01",
            ),
        );
    });

    it("upgrades a retired key to the family fork and warns on searched patients", async () => {
        const { result, holder } = renderPatient({
            patient: { template_key: "phlox_2", isNewEncounter: true },
            isNewPatient: false,
            isSearchedPatient: true,
        });

        await waitFor(() =>
            expect(result.current.currentTemplate?.template_key).toBe(
                "custom_phlox_1",
            ),
        );
        expect(holder.patient.template_key).toBe("custom_phlox_1");
        expect(warn).toHaveBeenCalled();
    });

    it("falls back to the default when the key's family has no live members", async () => {
        const { result, holder } = renderPatient({
            patient: { template_key: "itp_note_1", isNewEncounter: true },
            isNewPatient: false,
        });

        await waitFor(() =>
            expect(result.current.currentTemplate?.template_key).toBe(
                DEFAULT_KEY,
            ),
        );
        expect(holder.patient.template_key).toBe(DEFAULT_KEY);
    });

    it("falls back to the first template when there is no default", async () => {
        api.getDefaultTemplate.mockResolvedValue({ template_key: null });
        api.fetchTemplates.mockResolvedValue([
            TPL("custom_gout_1"),
            TPL("phlox_01"),
        ]);
        const { result } = renderPatient({
            patient: { template_key: "itp_note_1", isNewEncounter: true },
            isNewPatient: false,
        });

        await waitFor(() =>
            expect(result.current.currentTemplate?.template_key).toBe(
                "custom_gout_1",
            ),
        );
    });
});
