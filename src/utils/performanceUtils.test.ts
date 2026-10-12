import { describe, expect, it } from "vitest";
import {
    calculateLLMPerformance,
    getSmartRecommendations,
} from "./performanceUtils";

// Re-derive the documented formula constants independently in the test
const SCALING_EXPONENT = Math.log2(1 / 0.75);
const sizeFactor = (params: number) =>
    Math.pow(params / 8.0, SCALING_EXPONENT);

describe("calculateLLMPerformance", () => {
    it("anchors M3 Base 8B at the reference point (45s, factor 1)", () => {
        const result = calculateLLMPerformance(3, "Base", 8, undefined);
        expect(result.estimatedTime).toBeCloseTo(45, 10);
        expect(result.speedFactor).toBeCloseTo(1, 10);
        expect(result.displayText).toBe("~45s for 10min audio");
    });

    it("scales with generation (20%/gen improvement, M3 as reference)", () => {
        const m1 = calculateLLMPerformance(1, "Base", 8, undefined);
        expect(m1.speedFactor).toBeCloseTo(1 / (1.2 * 1.2), 10);
        expect(m1.estimatedTime).toBeCloseTo(45 * 1.2 * 1.2, 10);

        const m4 = calculateLLMPerformance(4, "Base", 8, undefined);
        expect(m4.speedFactor).toBeCloseTo(1.2, 10);
    });

    it("applies tier multipliers", () => {
        const max = calculateLLMPerformance(3, "Max", 8, undefined);
        expect(max.speedFactor).toBeCloseTo(3.3, 10);
        expect(max.estimatedTime).toBeCloseTo(45 / 3.3, 10);

        const ultra = calculateLLMPerformance(3, "Ultra", 8, undefined);
        expect(ultra.speedFactor).toBeCloseTo(6.6, 10);
    });

    it("falls back to the Base multiplier for unknown tiers", () => {
        const unknown = calculateLLMPerformance(3, "Nope", 8, undefined);
        const base = calculateLLMPerformance(3, "Base", 8, undefined);
        expect(unknown).toEqual(base);
    });

    it("penalizes larger models sublinearly (log scaling)", () => {
        const result = calculateLLMPerformance(3, "Base", 32, undefined);
        const factor = sizeFactor(32);
        expect(result.estimatedTime).toBeCloseTo(45 * factor, 10);
        expect(result.speedFactor).toBeCloseTo(1 / factor, 10);
    });

    it("uses active params over total params for MoE-style models", () => {
        const result = calculateLLMPerformance(4, "Max", 30, 3);
        const factor = sizeFactor(3);
        expect(result.estimatedTime).toBeCloseTo(
            (45 * factor) / (3.3 * 1.2),
            10,
        );
        expect(result.speedFactor).toBeCloseTo((3.3 * 1.2) / factor, 10);
    });
});

describe("getSmartRecommendations", () => {
    const models = () => [
        { id: "large", recommended_ram_gb: 32, size_mb: 300, tier: [3] },
        { id: "small", recommended_ram_gb: 8, size_mb: 100, tier: [1] },
        { id: "medium", recommended_ram_gb: 16, size_mb: 200, tier: [2] },
    ];

    it("returns an empty array when there are no models", () => {
        expect(getSmartRecommendations([], { total_memory_gb: 32 })).toEqual([]);
        expect(getSmartRecommendations(null, { total_memory_gb: 32 })).toEqual(
            [],
        );
    });

    it("returns sorted models with no badges when system specs are missing", () => {
        const result = getSmartRecommendations(models(), {});
        expect(result.map((m) => m.id)).toEqual(["small", "medium", "large"]);
        expect(result.every((m) => m.recommendedType === null)).toBe(true);
    });

    it("sorts by RAM then by download size as a tiebreaker", () => {
        const tied = [
            { id: "b", recommended_ram_gb: 8, size_mb: 200, tier: [1] },
            { id: "a", recommended_ram_gb: 8, size_mb: 100, tier: [1] },
        ];
        const result = getSmartRecommendations(tied, {});
        expect(result.map((m) => m.id)).toEqual(["a", "b"]);
    });

    it("filters out models that do not fit with a 4GB buffer", () => {
        // medium needs 16 + 4 = 20GB, so 18GB only fits small
        const result = getSmartRecommendations(models(), {
            total_memory_gb: 18,
        });
        expect(result.map((m) => m.id)).toEqual(["small"]);
    });

    it("pools discrete GPU VRAM with system RAM", () => {
        const result = getSmartRecommendations(models(), {
            total_memory_gb: 28,
            dgpu_vram_gb: 8,
        });
        expect(result.map((m) => m.id)).toEqual(["small", "medium", "large"]);
    });

    it("shows every model without badges when nothing fits", () => {
        const result = getSmartRecommendations(models(), {
            total_memory_gb: 4,
        });
        expect(result.map((m) => m.id)).toEqual(["small", "medium", "large"]);
        expect(result.every((m) => m.recommendedType === null)).toBe(true);
    });

    it("badges the in-tier model for the machine's RAM tier", () => {
        // 24GB → tier 2 → "medium" is the only tier-2 usable model
        const result = getSmartRecommendations(models(), {
            total_memory_gb: 24,
        });
        expect(result.map((m) => m.id)).toEqual(["small", "medium"]);
        expect(result.find((m) => m.id === "medium").recommendedType).toBe(
            "recommended",
        );
        expect(result.find((m) => m.id === "small").recommendedType).toBeNull();

        // 36GB → tier 3 → "large"
        const bigRam = getSmartRecommendations(models(), {
            total_memory_gb: 36,
        });
        expect(bigRam.find((m) => m.id === "large").recommendedType).toBe(
            "recommended",
        );
    });

    it("picks the middle in-tier model when several match", () => {
        const twoMatches = [
            { id: "a", recommended_ram_gb: 4, size_mb: 10, tier: [2] },
            { id: "b", recommended_ram_gb: 6, size_mb: 10, tier: [2] },
            { id: "c", recommended_ram_gb: 8, size_mb: 10, tier: [1] },
        ];
        const result = getSmartRecommendations(twoMatches, {
            total_memory_gb: 18,
        });
        expect(result.find((m) => m.id === "b").recommendedType).toBe(
            "recommended",
        );
        expect(result.find((m) => m.id === "a").recommendedType).toBeNull();
    });

    it("leaves everything unbadged when no model matches the tier", () => {
        const noMatch = [
            { id: "a", recommended_ram_gb: 4, size_mb: 10, tier: [1] },
        ];
        const result = getSmartRecommendations(noMatch, {
            total_memory_gb: 32,
        });
        expect(result.every((m) => m.recommendedType === null)).toBe(true);
    });

    it("defaults a missing recommended_ram_gb to 4GB", () => {
        const result = getSmartRecommendations(
            [{ id: "tiny", size_mb: 10, tier: [1] }],
            { total_memory_gb: 8 },
        );
        // 8 >= 4 + 4 buffer → usable, tier 1 matches
        expect(result).toHaveLength(1);
        expect(result[0].recommendedType).toBe("recommended");
    });
});
