import { sqliteTable, integer, text, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * food_profiles
 * ---------------
 * One normalized profile per 100 g, keyed by (canonical_name, brand, preparation).
 * Every nutrient is nullable: a value Gemini could not estimate is stored as
 * null, never invented, and the UI renders it as "dato non disponibile".
 *
 * base_grams:
 *   - 100  -> values are per 100 g; proportional scaling enabled.
 *   - null -> values are "per portion" (AI could not estimate grams); scaling
 *             disabled for this profile.
 *
 * nova_alignment (NOT is_healthy_flag):
 *   - Informational only. Derived from nova_group (1-2 -> 1, 3-4 -> 0, else null).
 *   - It is the alignment to the NOVA processing scale, NOT a health judgment.
 *     No scoring logic reads it.
 *
 * brand:
 *   - Present but always null in v1: the AI does not separate brand from name;
 *     a brand name stays inside canonical_name. Future extension point.
 */
export const foodProfiles = sqliteTable(
  "food_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    canonical_name: text("canonical_name").notNull(),
    brand: text("brand"),
    preparation: text("preparation"),
    base_grams: real("base_grams"),
    source: text("source").notNull().default("ai"),
    provider: text("provider").notNull().default("gemini"),
    confidence: real("confidence"),
    nova_alignment: integer("nova_alignment"),
    // Core nutrients (per 100 g or per portion) — all nullable.
    calories: integer("calories"),
    protein: real("protein"),
    carbs: real("carbs"),
    fat: real("fat"),
    // Health / detail nutrients — all nullable.
    sugar: real("sugar"),
    fiber: real("fiber"),
    category: text("category"),
    nova_group: integer("nova_group"),
    saturated_fat: real("saturated_fat"),
    monounsaturated_fat: real("monounsaturated_fat"),
    polyunsaturated_fat: real("polyunsaturated_fat"),
    omega_3: real("omega_3"),
    omega_6: real("omega_6"),
    trans_fat: real("trans_fat"),
    cholesterol: real("cholesterol"),
    sodium: real("sodium"),
    animal_protein: real("animal_protein"),
    vegetal_protein: real("vegetal_protein"),
    alcohol: real("alcohol"),
    // Boolean flags (0/1/null).
    carne_lavorata: integer("carne_lavorata"),
    carne_rossa: integer("carne_rossa"),
    pesce_alto_mercurio: integer("pesce_alto_mercurio"),
    additivi: integer("additivi"),
    alcol: integer("alcol"),
    created_at: text("created_at").notNull().default(sql`datetime('now')`),
  },
  (table) => ({
    // Identity: same name+brand+preparation -> one profile. "pizza" != "pizza
    // margherita" because canonical_name differs. (COALESCE so null brand/
    // preparation group together as ''.)
    uq_food_profiles_identity: uniqueIndex("uq_food_profiles_identity").on(
      table.canonical_name,
      sql`COALESCE(${table.brand}, '')`,
      sql`COALESCE(${table.preparation}, '')`
    ),
  })
);

/**
 * user_food_entries
 * ------------------
 * One row per user insertion. Carries an immutable snapshot of the calculated
 * nutrients (profile value x scale factor) so later edits to a profile never
 * alter diary history. No `servings` multiplier: the snapshot is already scaled.
 */
export const userFoodEntries = sqliteTable("user_food_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Present, fixed value ('local'); no real multi-user in v1. Future extension.
  user_id: text("user_id").notNull().default("local"),
  food_profile_id: integer("food_profile_id")
    .notNull()
    .references(() => foodProfiles.id),
  query_text: text("query_text").notNull(),
  // Canonical food name (snapshot of the profile's canonical_name) for display.
  name: text("name"),
  // null when the portion is not quantified (per-portion entry).
  requested_grams: real("requested_grams"),
  // Immutable snapshot, all nullable, already scaled to the requested portion.
  calculated_calories: integer("calculated_calories"),
  calculated_protein: real("calculated_protein"),
  calculated_carbs: real("calculated_carbs"),
  calculated_fat: real("calculated_fat"),
  calculated_sugar: real("calculated_sugar"),
  calculated_fiber: real("calculated_fiber"),
  calculated_category: text("calculated_category"),
  calculated_nova_group: integer("calculated_nova_group"),
  calculated_saturated_fat: real("calculated_saturated_fat"),
  calculated_monounsaturated_fat: real("calculated_monounsaturated_fat"),
  calculated_polyunsaturated_fat: real("calculated_polyunsaturated_fat"),
  calculated_omega_3: real("calculated_omega_3"),
  calculated_omega_6: real("calculated_omega_6"),
  calculated_trans_fat: real("calculated_trans_fat"),
  calculated_cholesterol: real("calculated_cholesterol"),
  calculated_sodium: real("calculated_sodium"),
  calculated_animal_protein: real("calculated_animal_protein"),
  calculated_vegetal_protein: real("calculated_vegetal_protein"),
  calculated_alcohol: real("calculated_alcohol"),
  calculated_carne_lavorata: integer("calculated_carne_lavorata"),
  calculated_carne_rossa: integer("calculated_carne_rossa"),
  calculated_pesce_alto_mercurio: integer("calculated_pesce_alto_mercurio"),
  calculated_additivi: integer("calculated_additivi"),
  calculated_alcol: integer("calculated_alcol"),
  calculated_base_grams: real("calculated_base_grams"),
  // Cooking method snapshot (from profile.preparation / AI) for sector-4 scoring.
  cooking_method: text("cooking_method"),
  logged_at: text("logged_at").notNull(), // YYYY-MM-DD
  created_at: text("created_at").notNull().default(sql`datetime('now')`),
});

/**
 * food_cache
 * -----------
 * Cache of AI queries so a repeat of an identical (normalized) query never
 * re-contacts Gemini. One row per component of a meal query ("pizza con
 * insalata" -> 2 rows). `normalized_query` is the key: normalized name
 * (grams removed) + brand + preparation, so "pizza" != "pizza margherita".
 * No TTL/eviction (local DB, small, benefit > space).
 */
export const foodCache = sqliteTable(
  "food_cache",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Normalized query text (grams removed). A multi-component query yields
    // several rows sharing this key (one per component), so uniqueness is on
    // (normalized_query, name) — see uq_food_cache_query_name below.
    normalized_query: text("normalized_query").notNull(),
    provider: text("provider").notNull().default("gemini"),
    // Component identity.
    name: text("name"),
    canonical_name: text("canonical_name"),
    brand: text("brand"),
    preparation: text("preparation"),
    base_grams: real("base_grams"),
    // serving_grams as returned by the AI (null if not determinable).
    estimated_grams: real("estimated_grams"),
    confidence: real("confidence"),
    // Nutrient snapshot in AI form (per described portion), ready to build a
    // profile + entry without re-contacting the AI.
    calories: integer("calories"),
    protein: real("protein"),
    carbs: real("carbs"),
    fat: real("fat"),
    sugar: real("sugar"),
    fiber: real("fiber"),
    category: text("category"),
    nova_group: integer("nova_group"),
    saturated_fat: real("saturated_fat"),
    monounsaturated_fat: real("monounsaturated_fat"),
    polyunsaturated_fat: real("polyunsaturated_fat"),
    omega_3: real("omega_3"),
    omega_6: real("omega_6"),
    trans_fat: real("trans_fat"),
    cholesterol: real("cholesterol"),
    sodium: real("sodium"),
    animal_protein: real("animal_protein"),
    vegetal_protein: real("vegetal_protein"),
    alcohol: real("alcohol"),
    carne_lavorata: integer("carne_lavorata"),
    carne_rossa: integer("carne_rossa"),
    pesce_alto_mercurio: integer("pesce_alto_mercurio"),
    additivi: integer("additivi"),
    alcol: integer("alcol"),
    created_at: text("created_at").notNull().default(sql`datetime('now')`),
  },
  (table) => ({
    // One row per (query, component). "pizza" (q="pizza") vs "pizza margherita"
    // (q="pizza margherita") are distinct keys, as required.
    uq_food_cache_query_name: uniqueIndex("uq_food_cache_query_name").on(table.normalized_query, table.name),
  })
);

/**
 * user_settings — unchanged from the legacy model (weight / gender / age),
 * still read by src/lib/settings-actions.ts. Kept here so the Drizzle schema
 * stays the single source of truth for the whole database.
 */
export const userSettings = sqliteTable("user_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weight: real("weight"),
  gender: text("gender"),
  age: integer("age"),
});
