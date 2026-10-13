import { afterEach, describe, expect, it, vi } from "vitest";
import { validateInput, formatPatientContext } from "./messageUtils";

describe("validateInput", () => {
    it("accepts input with non-whitespace characters", () => {
        expect(validateInput("hello")).toBe(true);
        expect(validateInput("  spaced  ")).toBe(true);
    });

    it("rejects blank input", () => {
        expect(validateInput("")).toBe(false);
        expect(validateInput("   \n\t ")).toBe(false);
    });
});

describe("formatPatientContext", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const template = {
        fields: [
            { field_key: "subjective", field_name: "Subjective" },
            { field_key: "objective", field_name: "Objective" },
        ],
    };

    const patientData = {
        name: "Jane Doe",
        dob: "1990-01-01",
        ur_number: "UR123",
        gender: "female",
        address: "1 Main St",
        phone: "555-0100",
        encounter_date: "2026-10-12",
        template_data: { subjective: "feels fine" },
    };

    it("returns null and logs when patient data is missing", () => {
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        expect(formatPatientContext(template, null)).toBeNull();
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("returns null and logs when the template is missing", () => {
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        expect(formatPatientContext(null, patientData)).toBeNull();
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("returns null when template fields are not an array", () => {
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        expect(
            formatPatientContext({ fields: "nope" }, patientData),
        ).toBeNull();
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("returns null when the patient has no template data yet", () => {
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        expect(
            formatPatientContext(template, { ...patientData, template_data: null }),
        ).toBeNull();
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("builds the backend context payload from patient + template", () => {
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const result = formatPatientContext(template, patientData);
        expect(result).toEqual({
            name: "Jane Doe",
            dob: "1990-01-01",
            ur_number: "UR123",
            gender: "female",
            address: "1 Main St",
            phone: "555-0100",
            encounter_date: "2026-10-12",
            template_data: { subjective: "feels fine" },
            template_fields: [
                { field_key: "subjective", field_name: "Subjective" },
                { field_key: "objective", field_name: "Objective" },
            ],
        });
        expect(errorSpy).not.toHaveBeenCalled();
    });
});
