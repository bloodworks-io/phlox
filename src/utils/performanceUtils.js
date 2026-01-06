/**
 * Performance calculation utilities for Apple Silicon LLM models.
 *
 * Baseline: M3 Base with 8B model = ~60s for 10min equivalent workload.
 *
 * Formula accounts for:
 * - M-series generation (M1-M4+): ~20% improvement per generation
 * - Chip tier (Base/Pro/Max/Ultra): Core count multiplier
 * - Model size: 0.75x time for half the parameters
 */

/**
 * Calculate LLM performance estimate for Apple Silicon.
 *
 * @param {number} genNumber - M-series generation (1-4)
 * @param {string} tier - Chip tier ("Base", "Pro", "Max", "Ultra")
 * @param {number} paramsBillions - Model parameter count in billions
 * @param {number} [activeParamsBillions] - Active parameters (for models like qwen3-30b with A3B architecture)
 * @returns {{estimatedTime: number, speedFactor: number, displayText: string}}
 */
export function calculateLLMPerformance(
  genNumber,
  tier,
  paramsBillions,
  activeParamsBillions,
) {
  // Tier multipliers (core count factor)
  const tierMultipliers = {
    Base: 1.0,
    Pro: 2.2,
    Max: 5.0,
    Ultra: 9.5,
  };

  // 20% improvement per generation
  const growthRate = 0.2;
  const genOffset = genNumber - 3; // M3 is reference point
  const gMult = Math.pow(1 + growthRate, genOffset);

  const tMult = tierMultipliers[tier] || 1.0;
  const baseSpeedFactor = tMult * gMult;

  // Model size scaling: 0.75x time for half the parameters
  // This means time scales with model size - smaller models are faster
  // Baseline is 8B = 60s, so we scale time relative to that
  const baselineParams = 8.0;
  // Use active parameters if available (e.g., qwen3-30b has 3B active)
  const effectiveParams = activeParamsBillions || paramsBillions;
  // Calculate how many times larger/smaller than baseline
  const sizeRatio = effectiveParams / baselineParams;
  // Apply scaling: each 2x size = 1/0.75 time multiplier (slower)
  // So modelSizeFactor = (sizeRatio ^ log2(1/0.75)) = sizeRatio ^ 0.415
  const scalingExponent = Math.log2(1 / 0.75);
  const modelSizeFactor = Math.pow(sizeRatio, scalingExponent);

  const totalSpeedFactor = baseSpeedFactor / modelSizeFactor;
  const estimatedTime = 60.0 * modelSizeFactor;

  return {
    estimatedTime,
    speedFactor: totalSpeedFactor,
    displayText: `~${Math.round(estimatedTime)}s for 10min audio`,
  };
}

/**
 * Parse Apple Silicon info from CPU brand string.
 *
 * @param {string} cpuBrand - CPU brand string (e.g., "Apple M3 Pro")
 * @returns {{generation: number, tier: string}|null}
 */
export function parseAppleSilicon(cpuBrand) {
  if (!cpuBrand) return null;

  const match = cpuBrand.match(/Apple M(\d+)\s*(Pro|Max|Ultra)?/i);
  if (!match) return null;

  return {
    generation: parseInt(match[1], 10),
    tier: match[2] || "Base",
  };
}
