/**
 * Target nutritional thresholds used for generating recommendations.
 * These values can be tuned based on user profiles in future updates.
 */
export const NUTRITION_TARGETS = {
  // Percentage of total daily calories
  SUGARS_MAX_PERCENT: 10, // max 10% of kcal from sugars
  FIBER_MIN_GRAMS: 25,    // target 25g fiber/day
  NOVA_MAX_PERCENT: 30,   // max 30% of kcal from NOVA 3-4 foods
  FAT_MAX_PERCENT: 35,    // max 35% of kcal from fats
  PROTEIN_MIN_PERCENT: 15, // min 15% of kcal from proteins
  AGGRESSIVE_COOKING_MAX: 2, // max 2 fried entries per day before a warning
} as const;

export type NutritionTargets = typeof NUTRITION_TARGETS;
