import type { Nutrition } from "../types";

/**
 * Represents an entry in a daily log, enriched with nutritional and categorization data
 * for use in the health analytics engine.
 *
 * `servings` is the portion factor of the diary entry (requested_grams /
 * base_grams, or 1 for per-portion entries); `food` carries the per-100 g
 * (or per-portion) values, so `food.x * servings` reproduces the entry's
 * immutable snapshot.
 */
export interface HealthEntry {
  id: number;
  servings: number;
  loggedAt: string; // YYYY-MM-DD
  food: Nutrition;
  cooking_method?: string | null;
  /** Cooking-method origin: "declared" (user) | "ai" (AI estimate) | "unknown". */
  cooking_source: "declared" | "ai" | "unknown";
  /** Data source for this entry's profile ("ai" = estimate, "user" = declared). */
  source: string;
  /** AI provider, when source === "ai" (e.g. "gemini"). */
  provider: string | null;
}

/**
 * Score with a short human-readable reason. Value is null when the data is
 * missing (not evaluable), never confused with 0.
 */
export interface Score03 {
  value: 0 | 1 | 2 | 3 | null;
  motivo: string;
  /** Coverage per indicatore "valutati/totale" (es. "4/5"): distingue la
   *  copertura generale da quella di questo singolo indicatore. */
  copertura?: string;
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
      /** Total entries for this sector. */
      entriesTotal: number;
      /** Entries with sufficient data for this sector. */
      entriesWithData: number;
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
      /** Total entries for this sector. */
      entriesTotal: number;
      /** Entries with sufficient data for this sector. */
      entriesWithData: number;
    };
    proteins: {
      /** Total protein in grams (null if not estimable). */
      totalGrams: number | null;
      animalGrams: number | null;
      vegetalGrams: number | null;
      /** Grams per kg of body weight (null if user weight unknown). */
      gramsPerKg: number | null;
      kcalPercentage: number | null;
      /** "mixed" when sources are balanced; "unknown" when animal+vegetal data
       * covers less than 90% of the total protein. */
      mix: "animal" | "vegetal" | "mixed" | "unknown" | null;
      /** Low if protein kcal share below target. Null when protein is unknown. */
      isLow: boolean | null;
      /** Total entries for this sector. */
      entriesTotal: number;
      /** Entries with sufficient data for this sector. */
      entriesWithData: number;
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
      /** NOVA 3-4 (processati + ultra-processati) share of daily kcal (null if categories unknown). */
      novaScore: number | null;
      /** NOVA 4 (ultra-processati only) share of daily kcal (null if categories unknown). */
      nova4KcalPercent: number | null;
      /** NOVA group counts among entries (0 = none). */
      novaCounts: { g1: number; g2: number; g3: number; g4: number; unknown: number };
      /** Entries with NOVA >= 3, with their kcal contribution: single source for
       *  detail rows, summary boxes and recommendations. */
      novaFoods: { name: string; group: number; kcal: number }[];
      /** Cooking-method origins across entries: declared by user / AI-estimated / unknown. */
      cookingSources: { declared: number; ai: number; unknown: number };
      /** High if any sector-4 score signals risk. Null when nothing is evaluable. */
      isHigh: boolean | null;
      /** Total entries for this sector. */
      entriesTotal: number;
      /** Entries with sufficient data for this sector. */
      entriesWithData: number;
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
  /** 0 to 1: GENERAL coverage — fraction of entries complete across the core fields.
   *  Per-indicator coverage is reported on each Score03.motivo (e.g. "4/5"). */
  coverage: number | null;
  /** Entries complete across the core fields (numerator of `coverage`). */
  entriesComplete: number;
  /** Aggregate data origin for the day's entries ("none" for an empty day). */
  source: "ai" | "user" | "mixed" | "none";
  /** AI provider, when the origin includes AI estimates. */
  provider: string | null;
}
