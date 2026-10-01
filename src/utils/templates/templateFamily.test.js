import { describe, expect, it } from "vitest";
import {
    compareFamilyOrder,
    familyMembers,
    getForkBase,
    getTemplateFamilyBase,
    isCustomizedDefault,
    latestInFamily,
} from "./templateFamily";

describe("getTemplateFamilyBase", () => {
    it("extracts protected bases", () => {
        expect(getTemplateFamilyBase("phlox_01")).toBe("phlox");
        expect(getTemplateFamilyBase("soap_3")).toBe("soap");
    });

    it("resolves fork keys to the protected family", () => {
        expect(getTemplateFamilyBase("custom_phlox_1")).toBe("phlox");
        expect(getTemplateFamilyBase("custom_progress_4")).toBe("progress");
    });

    it("keeps custom non-fork keys intact", () => {
        expect(getTemplateFamilyBase("custom_thing_1")).toBe("custom");
        expect(getTemplateFamilyBase("itp_follow-up_note-b_1")).toBe(
            "itp",
        );
    });

    it("handles empty input", () => {
        expect(getTemplateFamilyBase(undefined)).toBe("");
        expect(getTemplateFamilyBase("")).toBe("");
    });
});

describe("getForkBase / isCustomizedDefault", () => {
    it("identifies forks of protected templates only", () => {
        expect(getForkBase("custom_phlox_1")).toBe("phlox");
        expect(getForkBase("custom_gout_2")).toBeNull();
        expect(getForkBase("phlox_2")).toBeNull();
        expect(isCustomizedDefault("custom_phlox_1")).toBe(true);
        expect(isCustomizedDefault("custom_gout_2")).toBe(false);
        expect(isCustomizedDefault("phlox_01")).toBe(false);
    });
});

describe("compareFamilyOrder", () => {
    it("compares versions numerically", () => {
        expect(compareFamilyOrder("phlox_10", "phlox_9")).toBeGreaterThan(0);
        expect(compareFamilyOrder("phlox_2", "phlox_01")).toBeGreaterThan(0);
        expect(compareFamilyOrder("phlox_01", "phlox_1")).toBe(0);
    });

    it("ranks forks above protected versions", () => {
        expect(compareFamilyOrder("custom_phlox_1", "phlox_9")).toBeGreaterThan(
            0,
        );
        expect(compareFamilyOrder("custom_phlox_2", "custom_phlox_10")).toBeLessThan(
            0,
        );
    });
});

describe("familyMembers / latestInFamily", () => {
    const templates = [
        { template_key: "phlox_01" },
        { template_key: "phlox_3" },
        { template_key: "custom_phlox_1" },
        { template_key: "soap_01" },
        { template_key: "custom_gout_1" },
    ];

    it("groups forks with their protected family", () => {
        const keys = familyMembers(templates, "phlox_2").map(
            (t) => t.template_key,
        );
        expect(keys).toEqual(
            expect.arrayContaining(["phlox_01", "phlox_3", "custom_phlox_1"]),
        );
        expect(keys).not.toContain("soap_01");
        expect(keys).not.toContain("custom_gout_1");
    });

    it("fork wins over higher protected versions", () => {
        expect(latestInFamily(templates, "phlox_2").template_key).toBe(
            "custom_phlox_1",
        );
    });

    it("falls back to newest protected version when no fork exists", () => {
        expect(latestInFamily(templates, "soap_01").template_key).toBe(
            "soap_01",
        );
    });

    it("picks numerically largest version", () => {
        const versions = [
            { template_key: "phlox_9" },
            { template_key: "phlox_10" },
        ];
        expect(latestInFamily(versions, "phlox_2").template_key).toBe(
            "phlox_10",
        );
    });

    it("returns null for unknown families", () => {
        expect(latestInFamily(templates, "missing_1")).toBeNull();
        expect(latestInFamily([], "phlox_2")).toBeNull();
    });
});
