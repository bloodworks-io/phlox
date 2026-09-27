import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTemplateChange } from "./useTemplateChange";

// Writer-side contract for template switches: every confirmed switch must
// write patient.template_key (with data reset or pre-fill) BEFORE selecting
// the template — usePatientTemplate reconciles currentTemplate back to
// patient.template_key, so a switch that skips the write reverts.

const api = vi.hoisted(() => ({
    fetchPatientHistoryByTemplate: vi.fn(),
}));

vi.mock("@/utils/api/patientApi", () => ({ patientApi: api }));

const PREV = {
    ur_number: "UR00004",
    template_key: "phlox_01",
    template_data: { subjectives: "typed text" },
};

const renderTemplateChange = () => {
    const setPatient = vi.fn();
    const selectTemplate = vi.fn().mockResolvedValue(undefined);
    const utils = renderHook(
        () =>
            useTemplateChange({
                patient: PREV,
                setPatient,
                selectTemplate,
            }),
    );
    return { ...utils, setPatient, selectTemplate };
};

const switchTo = async (result, key) => {
    act(() => result.current.requestTemplateChange(key));
    await act(() => result.current.confirmTemplateChange());
};

// Evaluate the updater the hook passed to setPatient against the prior state.
const appliedPatient = (setPatient) =>
    setPatient.mock.calls[0][0](structuredClone(PREV));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("useTemplateChange", () => {
    it("opens the confirm modal with the pending key", () => {
        const { result } = renderTemplateChange();

        act(() => result.current.requestTemplateChange("soap_01"));

        expect(result.current.isChangeModalOpen).toBe(true);
        expect(result.current.pendingTemplateKey).toBe("soap_01");
    });

    it("pre-fills persistent fields from the most recent family note", async () => {
        api.fetchPatientHistoryByTemplate.mockResolvedValueOnce([
            { template_key: "soap_01", template_data: { allergies: "penicillin" } },
        ]);
        const { result, setPatient, selectTemplate } = renderTemplateChange();

        await switchTo(result, "soap_01");

        expect(api.fetchPatientHistoryByTemplate).toHaveBeenCalledWith(
            "UR00004",
            "soap",
        );
        expect(appliedPatient(setPatient)).toEqual({
            ur_number: "UR00004",
            template_key: "soap_01",
            template_data: { allergies: "penicillin" },
        });
        expect(selectTemplate).toHaveBeenCalledWith("soap_01");
        expect(result.current.isChangeModalOpen).toBe(false);
    });

    it("no history: writes the new key and resets fields before selecting", async () => {
        api.fetchPatientHistoryByTemplate.mockResolvedValueOnce([]);
        const { result, setPatient, selectTemplate } = renderTemplateChange();

        await switchTo(result, "soap_01");

        expect(appliedPatient(setPatient)).toEqual({
            ur_number: "UR00004",
            template_key: "soap_01",
            template_data: {},
        });
        // Key must be written before selection so the reconciliation in
        // usePatientTemplate can never observe the desync and revert.
        expect(setPatient.mock.invocationCallOrder[0]).toBeLessThan(
            selectTemplate.mock.invocationCallOrder[0],
        );
        expect(selectTemplate).toHaveBeenCalledWith("soap_01");
        expect(result.current.isChangeModalOpen).toBe(false);
    });

    it("history lookup failure falls back to the reset path", async () => {
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        api.fetchPatientHistoryByTemplate.mockRejectedValueOnce(
            new Error("boom"),
        );
        const { result, setPatient, selectTemplate } = renderTemplateChange();

        await switchTo(result, "soap_01");

        expect(appliedPatient(setPatient)).toEqual({
            ur_number: "UR00004",
            template_key: "soap_01",
            template_data: {},
        });
        expect(selectTemplate).toHaveBeenCalledWith("soap_01");
        errorSpy.mockRestore();
    });

    it("skips the history lookup for patients without a UR number", async () => {
        const setPatient = vi.fn();
        const selectTemplate = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() =>
            useTemplateChange({
                patient: { ur_number: "", template_key: "phlox_01" },
                setPatient,
                selectTemplate,
            }),
        );

        await switchTo(result, "soap_01");

        expect(api.fetchPatientHistoryByTemplate).not.toHaveBeenCalled();
        expect(selectTemplate).toHaveBeenCalledWith("soap_01");
    });
});
