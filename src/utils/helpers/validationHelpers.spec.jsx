import { describe, it, expect } from "vitest";
import {
    areRequiredDemographicsMet,
    validateLetterData,
} from "./validationHelpers";

describe("areRequiredDemographicsMet", () => {
    it("returns false when patient is undefined", () => {
        expect(areRequiredDemographicsMet(undefined)).toBe(false);
    });

    it("returns false when any required field is missing or blank", () => {
        expect(areRequiredDemographicsMet({ first_name: "A" })).toBe(false);
        expect(
            areRequiredDemographicsMet({
                first_name: "  ",
                last_name: "B",
                dob: "2000-01-01",
                ur_number: "UR1",
            }),
        ).toBe(false);
    });

    it("returns true when all required fields are present and non-blank", () => {
        expect(
            areRequiredDemographicsMet({
                first_name: "Ada",
                last_name: "Lovelace",
                dob: "1815-12-10",
                ur_number: "UR1",
            }),
        ).toBe(true);
    });
});

describe("validateLetterData", () => {
    it("returns true for a valid letter", () => {
        expect(validateLetterData({ patientName: "Ada", gender: "F" })).toBe(true);
    });

    it("throws when patientName is empty", () => {
        expect(() => validateLetterData({ patientName: "", gender: "F" })).toThrow(
            "Invalid patientName",
        );
    });
});
