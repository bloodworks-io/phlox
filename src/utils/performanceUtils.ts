
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

  const baselineParams = 8.0;
  const effectiveParams = activeParamsBillions || paramsBillions;
  // Calculate how many times larger/smaller than baseline
  const sizeRatio = effectiveParams / baselineParams;
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

/**
 * Get smart LLM model recommendations based on system specifications.
 *
 * @param {Array} availableModels - Array of available model objects from API
 * @param {Object} systemSpecs - System specifications containing total_memory_gb
 * @returns {Array} All models with recommendedType property, ordered by size
 */
export function getSmartRecommendations(availableModels, systemSpecs) {
  if (!availableModels?.length) return [];

  // Sort all models by size (smallest first)
  const sortedModels = [...availableModels].sort((a, b) => a.size_mb - b.size_mb);

  // If no system specs or no RAM value, return models without badges
  if (!systemSpecs?.total_memory_gb) {
    return sortedModels.map((model) => ({
      ...model,
      recommendedType: null,
    }));
  }

  const ram = systemSpecs.total_memory_gb;
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

  // First pass: identify which models are recommended (in tier AND fit in RAM)
  const sortedModelsWithRecStatus = usableModels.map((model) => {
    const modelTier = model.tier || [];
    const recommendedRam = model.recommended_ram_gb || 4;
    const isInTier = modelTier.length > 0 && modelTier.includes(tier);
    const fitsInRam = ram >= recommendedRam;
    const isRecommended = isInTier && fitsInRam;
    return { ...model, isRecommended };
  });

  // Count how many recommended models come before each position
  let recommendedCount = 0;
  const modelsWithBadges = sortedModelsWithRecStatus.map((model) => {
    if (model.isRecommended) {
      let recommendedType;
      if (recommendedCount === 0) {
        recommendedType = "fastest"; // Smallest recommended
      } else if (recommendedCount === 1) {
        recommendedType = "recommended"; // Middle
      } else if (recommendedCount === 2) {
        recommendedType = "best_quality"; // Largest recommended
      } else {
        recommendedType = null;
      }
      recommendedCount++;
      return { ...model, recommendedType };
    } else {
      // Not recommended - assign appropriate badge
      const modelTier = model.tier || [];
      const recommendedRam = model.recommended_ram_gb || 4;

      // Skip models with no tier classification (like tiny/ultra edge cases)
      if (modelTier.length === 0) {
        return { ...model, recommendedType: null };
      }

      const maxModelTier = Math.max(...modelTier);
      const minModelTier = Math.min(...modelTier);
      const isBelowUserTier = maxModelTier < tier;
      const isAboveUserTier = minModelTier > tier;
      const fitsInRam = ram >= recommendedRam;

      let recommendedType;

      if (isBelowUserTier) {
        // Model is below user's capability level (e.g., tier 1 model for tier 2 user)
        recommendedType = "poor_quality";
      } else if (isAboveUserTier || !fitsInRam) {
        // Model is above user's tier capability OR doesn't fit in RAM
        recommendedType = "slow_performance";
      } else {
        recommendedType = null;
      }

      return { ...model, recommendedType };
    }
  });

  return modelsWithBadges;
}
