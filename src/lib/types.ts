/**
 * Core nutrition payload: one named food plus its nutrients, all nullable.
 *
 * A null means "dato non disponibile" (Gemini could not estimate it) — never 0,
 * never invented. This shape is shared by:
 *   - FoodProfile   (a normalized profile, per 100 g or per portion)
 *   - HealthEntry.food (the scaled per-portion snapshot the health engine reads)
 *
 * The boolean flags are `boolean | null`: the DB stores 0/1/null, and the
 * health engine scores with `=== true` / `== null`, so the value is normalized
 * to a real boolean (or null) before reaching it.
 */
export interface Nutrition {
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugar: number | null;
  fiber: number | null;
  category: string | null;
  nova_group: number | null;
  saturated_fat: number | null;
  monounsaturated_fat: number | null;
  polyunsaturated_fat: number | null;
  omega_3: number | null;
  omega_6: number | null;
  trans_fat: number | null;
  cholesterol: number | null;
  sodium: number | null;
  animal_protein: number | null;
  vegetal_protein: number | null;
  alcohol: number | null;
  carne_lavorata: boolean | null;
  carne_rossa: boolean | null;
  alcol: boolean | null;
  pesce_alto_mercurio: boolean | null;
  additivi: boolean | null;
  /** Data origin (informational): "ai" = AI estimate, "user" = user-declared. */
  source?: string | null;
  /** AI provider, when the data originates from AI (e.g. "gemini"). */
  provider?: string | null;
}

/**
 * A normalized profile (food_profiles row). Values are per 100 g when
 * base_grams = 100, or "per portion" when base_grams is null.
 */
export interface FoodProfile extends Nutrition {
  id: number;
  brand: string | null;
  preparation: string | null;
  /** 100 when normalized to per-100g; null when per-portion (no scaling). */
  base_grams: number | null;
  source: string;
  provider: string;
  /** 0..1 coverage of populated nutrient fields at insert time. Never invented. */
  confidence: number | null;
  /** NOVA alignment (1-2 -> 1, 3-4 -> 0, else null). Informational, not a health judgment. */
  nova_alignment: number | null;
}

/**
 * One item returned by Gemini (the AI response shape). Core fields
 * (name, calories, protein, carbs, fat) are mandatory in the response; every
 * health field and serving_grams is nullable. `serving_grams` is the numeric
 * estimate of the described portion that drives base_grams normalization.
 */
export interface AiItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Human-readable serving description from the AI (optional, preview only). */
  servingSize: string | null;
  /** Total estimated grams of this item in the described portion; null if not determinable. */
  serving_grams: number | null;
  sugar: number | null;
  fiber: number | null;
  category: string | null;
  nova_group: number | null;
  saturated_fat: number | null;
  monounsaturated_fat: number | null;
  polyunsaturated_fat: number | null;
  omega_3: number | null;
  omega_6: number | null;
  trans_fat: number | null;
  cholesterol: number | null;
  sodium: number | null;
  animal_protein: number | null;
  vegetal_protein: number | null;
  alcohol: number | null;
  cooking_method: string | null;
  carne_lavorata: boolean | null;
  carne_rossa: boolean | null;
  alcol: boolean | null;
  pesce_alto_mercurio: boolean | null;
  additivi: boolean | null;
}

/**
 * One user diary insertion (user_food_entries row). The `calculated_*` fields
 * are the immutable per-portion snapshot — already scaled, no `servings`
 * multiplier. `name` is the canonical food name (snapshot of the profile).
 */
export interface FoodEntry {
  id: number;
  name: string | null;
  query_text: string;
  requested_grams: number | null;
  calculated_calories: number | null;
  calculated_protein: number | null;
  calculated_carbs: number | null;
  calculated_fat: number | null;
  logged_at: string;
}

export interface DailyLogData {
  entries: FoodEntry[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}
