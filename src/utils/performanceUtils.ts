
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
  // Tier multipliers (based on M3 anchored memory bandwidth ratios)
  const tierMultipliers = {
    Base: 1.0,
    Pro: 1.25,
    Max: 3.3,
    Ultra: 6.6,
  };

  // 20% improvement per generation
  const growthRate = 0.2;
  const genOffset = genNumber - 3; // M3 is reference point
  const gMult = Math.pow(1 + growthRate, genOffset);

  const tMult = tierMultipliers[tier] || 1.0;
  const baseSpeedFactor = tMult * gMult;

  const baselineParams = 8.0;
  const effectiveParams = activeParamsBillions || paramsBillions;
  // Calculate how many times larger/smaller than baseline
  const sizeRatio = effectiveParams / baselineParams;
  const scalingExponent = Math.log2(1 / 0.75);
  const modelSizeFactor = Math.pow(sizeRatio, scalingExponent);

  const totalSpeedFactor = baseSpeedFactor / modelSizeFactor;
  const estimatedTime = (45.0 * modelSizeFactor) / baseSpeedFactor;

  return {
    estimatedTime,
    speedFactor: totalSpeedFactor,
    displayText: `~${Math.round(estimatedTime)}s for 10min audio`,
  };
}


/**
 * Get smart LLM model recommendations based on system specifications.

 *
 * @param {Array} availableModels - Array of available model objects from API
 * @param {Object} systemSpecs - System specifications containing total_memory_gb
 * @returns {Array} All models with recommendedType property, ordered by RAM requirement
 */
export function getSmartRecommendations(availableModels, systemSpecs) {
  if (!availableModels?.length) return [];

  // Sort by recommended RAM (lightest first), with size as tiebreaker
  const sortedModels = [...availableModels].sort((a, b) => {
    const ramA = a.recommended_ram_gb || 4;
    const ramB = b.recommended_ram_gb || 4;
    if (ramA !== ramB) return ramA - ramB;
    return a.size_mb - b.size_mb;
  });

  // If no system specs or no RAM value, return models without badges
  if (!systemSpecs?.total_memory_gb) {
    return sortedModels.map((model) => ({
      ...model,
      recommendedType: null,
    }));
  }

  // Pool system RAM with discrete GPU VRAM on platforms that expose it
  const ram = systemSpecs.total_memory_gb + (systemSpecs.dgpu_vram_gb || 0);
  const RAM_BUFFER_GB = 4;

  // Filter out models that won't fit with at least a 4GB buffer
  const usableModels = sortedModels.filter((model) => {
    const recommendedRam = model.recommended_ram_gb || 4;
    return ram >= recommendedRam + RAM_BUFFER_GB;
  });

  // Determine tier based on machine RAM
  let tier;
  if (ram < 16) {
    tier = 1;
  } else if (ram < 32) {
    tier = 2;
  } else {
    tier = 3;
  }

  // Identify in-tier models (those whose tier array includes the user's tier)
  const inTierIndices = [];
  usableModels.forEach((model, idx) => {
    const modelTier = model.tier || [];
    if (modelTier.length > 0 && modelTier.includes(tier)) {
      inTierIndices.push(idx);
    }
  });

  // Pick the middle in-tier model as "recommended"
  // (2nd if 2+, 1st if only 1 — ensures the star always shows when there's a match)
  const recommendedIdx =
    inTierIndices.length > 0
      ? inTierIndices[Math.min(1, inTierIndices.length - 1)]
      : -1;

  return usableModels.map((model, idx) => ({
    ...model,
    recommendedType: idx === recommendedIdx ? "recommended" : null,
  }));
}
