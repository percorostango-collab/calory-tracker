import type { Food, NewFood } from "../types";

/**
 * Represents an entry in a daily log, enriched with nutritional and categorization data
 * for use in the health analytics engine.
 */
export interface HealthEntry {
  id: number;
  servings: number;
  loggedAt: string; // YYYY-MM-DD
  food: Food;
  cooking_method?: string | null;
}

/**
 * Score with a short human-readable reason. Value is null when the data is
 * missing (not evaluable), never confused with 0.
 */
export interface Score03 {
  value: 0 | 1 | 2 | 3 | null;
  motivo: string;
}

/**
 * Aggregated daily metrics for the 4 Healthy Sectors (Settori Salutari).
 *
 * Nullable fields distinguish "unknown" (null) from "zero" (0): a nutrient that
 * Gemini could not estimate is null, not 0. Coverage reports the fraction of
 * entries with complete health data.
 */
export interface DailyHealthMetrics {
  totals: {
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
    fiber: number;
  };
  sectors: {
    sugars: {
      /** Total sugars in grams (null if not estimable). */
      totalGrams: number | null;
      /** Simple sugars in grams (stimata quando totalGrams nota ma non scomponibile). */
      simpleGrams: number | null;
      /** Complex carbs in grams (stimata quando totalGrams nota ma non scomponibile). */
      complexGrams: number | null;
      /** Estimated glycemic class: low / medium / high (null if not estimable). */
      glycemicClass: "low" | "medium" | "high" | null;
      kcalPercentage: number | null;
      /** High if sugars kcal share exceeds target. Null when sugars are unknown. */
      isHigh: boolean | null;
    };
    lipids: {
      /** Total fat in grams (null if not estimable). */
      totalGrams: number | null;
      saturatedGrams: number | null;
      monounsaturatedGrams: number | null;
      polyunsaturatedGrams: number | null;
      omega3Grams: number | null;
      omega6Grams: number | null;
      transGrams: number | null;
      cholesterolMg: number | null;
      /** Triglycerides risk: basso / medio / alto / null (dati insufficienti). */
      triglyceridesIndicator: "basso" | "medio" | "alto" | null;
      /** Factors that raised the triglycerides indicator (simple sugars, alcohol, saturated fat). */
      triglyceridesFactors: string[];
      kcalPercentage: number | null;
      /** High if fat kcal share exceeds target. Null when fat is unknown. */
      isHigh: boolean | null;
    };
    proteins: {
      /** Total protein in grams (null if not estimable). */
      totalGrams: number | null;
      animalGrams: number | null;
      vegetalGrams: number | null;
      /** Grams per kg of body weight (null if user weight unknown). */
      gramsPerKg: number | null;
      kcalPercentage: number | null;
      /** "mixed" also when the source is unknown (undecidable). */
      mix: "animal" | "vegetal" | "mixed" | null;
      /** Low if protein kcal share below target. Null when protein is unknown. */
      isLow: boolean | null;
    };
    harmful_substances: {
      /** Score 0-3: processed meat (carne_lavorata flag). */
      processedMeat: Score03;
      /** Score 0-3: red meat (carne_rossa flag). */
      redMeat: Score03;
      /** Score 0-3: high-temperature cooking (fritto/frittura/grigliato/arrosto). */
      highTempCooking: Score03;
      /** Score 0-3: ultra-processed foods (NOVA group 4). */
      ultraProcessed: Score03;
      /** Score 0-3: alcohol presence. */
      alcohol: Score03;
      /** Score 0-3: sodium level. */
      sodium: Score03;
      /** Score 0-3: high-mercury fish. */
      mercury: Score03;
      /** Score 0-3: food additives. */
      additivi: Score03;
      /** NOVA 3-4 share of total daily kcal (null if categories unknown). */
      novaScore: number | null;
      /** High if any sector-4 score signals risk. Null when nothing is evaluable. */
      isHigh: boolean | null;
    };
  };
  fiber: {
    totalGrams: number | null;
    /** Low if fiber below target. Null when fiber is unknown. */
    isLow: boolean | null;
  };
  /** Overall daily load: low / medium / high. Based ONLY on sector-4 scores (0-3). Null if no data. */
  dailyLoad: "low" | "medium" | "high" | null;
  /** Food names contributing to the daily load (critical sectors). */
  dailyLoadFoods: string[];
  /** 0 to 1: fraction of entries with complete (non-null) health data. Null if no entries. */
  coverage: number | null;
}
