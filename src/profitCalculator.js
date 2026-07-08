const crops = require('../data/crops.json');

// Water availability ranking - a farmer's available water must meet or exceed
// the crop's water need to be considered viable.
const WATER_LEVELS = { none: 0, low: 1, medium: 2, high: 3 };

/**
 * Converts land area to acres if given in cents (1 acre = 100 cents,
 * standard convention in Andhra Pradesh / South India).
 */
function toAcres(landArea, unit) {
  if (unit === 'cents') return landArea / 100;
  return landArea; // already in acres
}

/**
 * Filters the crop dataset down to crops that are actually viable
 * for the farmer's stated conditions.
 */
function filterViableCrops(input) {
  const { soilType, landType, waterAvailability, season } = input;
  const farmerWaterLevel = WATER_LEVELS[waterAvailability];

  return crops.filter((crop) => {
    const seasonMatch = crop.season === season;
    const soilMatch = crop.soil_type.includes(soilType);
    const landMatch = crop.land_type.includes(landType);
    const waterMatch = WATER_LEVELS[crop.water_need] <= farmerWaterLevel;
    return seasonMatch && soilMatch && landMatch && waterMatch;
  });
}

/**
 * Calculates cost, yield, revenue, and profit for a single crop
 * given the farmer's land area.
 */
function calculateProfitForCrop(crop, landAreaAcres) {
  const cost = Math.round(crop.cost_per_acre * landAreaAcres);
  const yieldKg = Math.round(crop.yield_per_acre_kg * landAreaAcres);
  const revenue = Math.round(yieldKg * crop.price_per_kg);
  const profit = revenue - cost;

  return {
    crop: crop.crop,
    cost_estimate: cost,
    expected_yield_kg: yieldKg,
    expected_selling_price_per_kg: crop.price_per_kg,
    expected_revenue: revenue,
    expected_profit: profit,
    confidence: crop.data_confidence,
    notes: crop.notes,
  };
}

/**
 * Main entry point: given farmer inputs, returns a ranked list of
 * viable crops sorted by expected profit (highest first).
 *
 * input = {
 *   landArea: number,
 *   landAreaUnit: 'acres' | 'cents',
 *   soilType: string,
 *   landType: 'dryland' | 'wetland',
 *   waterAvailability: 'none' | 'low' | 'medium' | 'high',
 *   season: 'kharif' | 'rabi' | 'zaid',
 *   location: string  (reserved for future regional price adjustment)
 * }
 */
function recommendCrops(input) {
  const landAreaAcres = toAcres(input.landArea, input.landAreaUnit);
  const viableCrops = filterViableCrops(input);

  if (viableCrops.length === 0) {
    return {
      success: false,
      message:
        'No crops in the current dataset match these conditions. Consider broadening water availability or checking soil type input.',
      ranked: [],
    };
  }

  const ranked = viableCrops
    .map((crop) => calculateProfitForCrop(crop, landAreaAcres))
    .sort((a, b) => b.expected_profit - a.expected_profit);

  return {
    success: true,
    landAreaAcres,
    ranked,
    topRecommendation: ranked[0],
  };
}

module.exports = { recommendCrops, filterViableCrops, calculateProfitForCrop };
