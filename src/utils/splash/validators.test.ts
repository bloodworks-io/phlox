import { describe, expect, it } from "vitest";
import {
    validatePersonalStep,
    validateLLMStep,
    validateTranscriptionStep,
    validateTemplatesStep,
    validateQuickChatStep,
    validateLettersStep,
} from "./validators";

describe("validatePersonalStep", () => {
    it("passes with a name (even padded) and a specialty", () => {
        expect(validatePersonalStep("  Jane  ", "Cardiology")).toBeTruthy();
    });

    it("fails when the name is blank", () => {
        expect(validatePersonalStep("   ", "Cardiology")).toBeFalsy();
    });

    it("fails when the specialty is empty", () => {
        expect(validatePersonalStep("Jane", "")).toBeFalsy();
    });
});

describe("validateLLMStep", () => {
    it("passes when models are available and one is selected", () => {
        expect(validateLLMStep([{ id: "m1" }], "m1")).toBe(true);
    });

    it("passes when no models are available even without a selection", () => {
        expect(validateLLMStep([], "")).toBe(true);
    });

    it("fails when models are available but none is selected", () => {
        expect(validateLLMStep([{ id: "m1" }], "")).toBe(false);
    });
});

describe("validateTranscriptionStep", () => {
    it("is optional: empty base URL always passes", () => {
        expect(
            validateTranscriptionStep("", true, [{ id: "w1" }], ""),
        ).toBe(true);
    });

    it("fails when the model list is available but no model is chosen", () => {
        expect(
            validateTranscriptionStep(
                "http://localhost:9000",
                true,
                [{ id: "w1" }],
                "",
            ),
        ).toBe(false);
    });

    it("fails when the model list is unavailable but a URL is set with no model", () => {
        expect(
            validateTranscriptionStep(
                "http://localhost:9000",
                false,
                [],
                "",
            ),
        ).toBe(false);
    });

    it("passes with a URL and a selected model", () => {
        expect(
            validateTranscriptionStep(
                "http://localhost:9000",
                true,
                [{ id: "w1" }],
                "w1",
            ),
        ).toBe(true);
    });
});

describe("validateTemplatesStep", () => {
    it("requires a non-empty template selection", () => {
        expect(validateTemplatesStep("")).toBe(false);
        expect(validateTemplatesStep("soap")).toBe(true);
    });
});

describe("validateQuickChatStep", () => {
    const filled: [string, string, string, string, string, string] = [
        "T1",
        "P1",
        "T2",
        "P2",
        "T3",
        "P3",
    ];

    it("passes when all three title/prompt pairs are filled", () => {
        expect(validateQuickChatStep(...filled)).toBeTruthy();
    });

    it("fails when any single field is blank", () => {
        for (let i = 0; i < filled.length; i++) {
            const args: typeof filled = [...filled];
            args[i] = "   ";
            expect(validateQuickChatStep(...args)).toBeFalsy();
        }
    });
});

describe("validateLettersStep", () => {
    it("requires a non-empty letter template selection", () => {
        expect(validateLettersStep("")).toBe(false);
        expect(validateLettersStep("referral")).toBe(true);
    });
});
