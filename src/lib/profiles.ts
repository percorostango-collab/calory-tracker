import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { foodProfiles, userFoodEntries, foodCache } from "../db/schema";
import type { AiItem, FoodProfile } from "./types";

/**
 * Core "profiles / entries / cache" logic.
 *
 * Flow per user query (text or image):
 *   1. parseQuantity  -> extract mass/volume in grams (kg/g/hg/qg/ml/l) BEFORE
 *      the AI call; remove the token so it never pollutes the cache key.
 *   2. normalizeQuery -> lowercase, compress spaces, strip filler words.
 *   3. cache lookup on normalized_query (skip when the key is empty, e.g. an
 *      image with no note). Hit -> reuse the cached component rows, no AI.
 *   4. miss -> call Gemini, write one cache row per component.
 *   5. for each component: resolve-or-create a profile (per 100 g when the AI
 *      gave serving_grams, else per-portion) and record ONE user entry with an
 *      immutable, scaled snapshot.
 *
 * Rules (per spec): a gram change reuses the same profile (zero extra AI calls);
 * a brand/preparation change makes a new profile; nothing is ever invented —
 * a missing value stays null and the UI shows "dato non disponibile".
 */

// Numeric nutrient fields that are scaled by the portion factor.
const NUMERIC_FIELDS = [
  "calories", "protein", "carbs", "fat", "sugar", "fiber",
  "saturated_fat", "monounsaturated_fat", "polyunsaturated_fat",
  "omega_3", "omega_6", "trans_fat", "cholesterol", "sodium",
  "animal_protein", "vegetal_protein", "alcohol",
] as const;
type NumericKey = (typeof NUMERIC_FIELDS)[number];

// Fields that count toward profile "confidence" (coverage of populated data).
const CONFIDENCE_FIELDS: (keyof AiItem)[] = [
  ...NUMERIC_FIELDS, "category", "nova_group",
  "carne_lavorata", "carne_rossa", "alcol", "pesce_alto_mercurio", "additivi",
];

function round(v: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(v * p) / p;
}

/** boolean|null -> 0/1/null (DB storage form). */
function b2i(b: boolean | null): number | null {
  return b == null ? null : b ? 1 : 0;
}
/** 0/1/null (DB) -> boolean|null (app form, used by the health engine). */
function i2b(n: number | null): boolean | null {
  return n == null ? null : n === 1;
}

const STOPWORDS = new Set([
  "di", "con", "a", "al", "alla", "allo", "del", "della", "dell", "da",
  "in", "per", "il", "la", "i", "le", "un", "una", "dei", "delle", "e", "ed",
]);

/**
 * Extract the total mass/volume (in grams) from a description, removing the
 * quantity token(s) so the remainder is the food identity.
 *   kg -> x1000, hg -> x100, qg -> /1000, g/grammi/grammo/ml -> x1, l -> x1000.
 * Multiple quantities are summed (e.g. a dish with several measured parts).
 * Non-mass units ("2 fette", "1 porzione") are left in the text -> a distinct
 * profile, scaled per-portion (no crash).
 */
export function parseQuantity(text: string): { grams: number | null; rest: string } {
  const re = /(\d+(?:[.,]\d+)?)\s*(kg|grammi|grammo|hg|qg|ml|l|g)\b/gi;
  let grams = 0;
  let found = false;
  const stripped = text.replace(re, (_m, num: string, unit: string) => {
    const val = parseFloat(num.replace(",", "."));
    const u = unit.toLowerCase();
    if (u === "kg") grams += val * 1000;
    else if (u === "hg") grams += val * 100;
    else if (u === "qg") grams += val / 1000;
    else if (u === "l") grams += val * 1000;
    else grams += val; // g / grammi / grammo / ml
    found = true;
    return " ";
  });
  return { grams: found ? grams : null, rest: normalizeQuery(stripped) };
}

/**
 * Normalize a food name for use as a cache / profile key: lowercase, trim,
 * compress whitespace, and drop leading/trailing filler words ("di", "con", ...).
 * "100g di pizza" -> rest "di pizza" -> "pizza". "Pizza Margherita" ->
 * "pizza margherita" (distinct from "pizza").
 */
export function normalizeQuery(s: string): string {
  let words = s.toLowerCase().trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  while (words.length > 0 && STOPWORDS.has(words[0])) words.shift();
  while (words.length > 0 && STOPWORDS.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

/** Convert a fresh AI item to its cache row (per-portion values, key by query). */
function aiItemToCache(normalizedQuery: string, c: AiItem) {
  return {
    normalized_query: normalizedQuery,
    provider: "gemini",
    name: c.name,
    canonical_name: c.name,
    brand: null,
    preparation: c.cooking_method,
    base_grams: c.serving_grams != null && c.serving_grams > 0 ? 100 : null,
    estimated_grams: c.serving_grams,
    confidence: computeConfidence(c),
    calories: c.calories ?? null,
    protein: c.protein ?? null,
    carbs: c.carbs ?? null,
    fat: c.fat ?? null,
    sugar: c.sugar, fiber: c.fiber, category: c.category, nova_group: c.nova_group,
    saturated_fat: c.saturated_fat, monounsaturated_fat: c.monounsaturated_fat,
    polyunsaturated_fat: c.polyunsaturated_fat, omega_3: c.omega_3, omega_6: c.omega_6,
    trans_fat: c.trans_fat, cholesterol: c.cholesterol, sodium: c.sodium,
    animal_protein: c.animal_protein, vegetal_protein: c.vegetal_protein,
    alcohol: c.alcohol,
    carne_lavorata: b2i(c.carne_lavorata), carne_rossa: b2i(c.carne_rossa),
    pesce_alto_mercurio: b2i(c.pesce_alto_mercurio), additivi: b2i(c.additivi),
    alcol: b2i(c.alcol),
  };
}

/** Rebuild an AI item from a cache row (per-portion values) so a cache hit
 *  flows through the exact same profile/entry code as a miss. */
function cacheRowToAiItem(r: typeof foodCache.$inferSelect): AiItem {
  return {
    name: r.name ?? r.canonical_name ?? "",
    calories: r.calories ?? 0,
    protein: r.protein ?? 0,
    carbs: r.carbs ?? 0,
    fat: r.fat ?? 0,
    servingSize: null,
    serving_grams: r.estimated_grams,
    sugar: r.sugar, fiber: r.fiber, category: r.category, nova_group: r.nova_group,
    saturated_fat: r.saturated_fat, monounsaturated_fat: r.monounsaturated_fat,
    polyunsaturated_fat: r.polyunsaturated_fat, omega_3: r.omega_3, omega_6: r.omega_6,
    trans_fat: r.trans_fat, cholesterol: r.cholesterol, sodium: r.sodium,
    animal_protein: r.animal_protein, vegetal_protein: r.vegetal_protein,
    alcohol: r.alcohol,
    cooking_method: r.preparation,
    carne_lavorata: i2b(r.carne_lavorata), carne_rossa: i2b(r.carne_rossa),
    alcol: i2b(r.alcol), pesce_alto_mercurio: i2b(r.pesce_alto_mercurio),
    additivi: i2b(r.additivi),
  };
}

/** Fraction (0..1) of populated nutrient/flag fields. Never invented. */
function computeConfidence(c: AiItem): number {
  const total = CONFIDENCE_FIELDS.length;
  let present = 0;
  for (const f of CONFIDENCE_FIELDS) {
    if (c[f] != null) present++;
  }
  return total > 0 ? round(present / total, 3) : 0;
}

/** Per-100 g values from the AI's per-portion values (serving_grams known). */
function per100Values(c: AiItem, grams: number): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const f of NUMERIC_FIELDS) {
    const v = c[f];
    out[f] = v == null ? null : round(v / grams * 100, f === "calories" ? 0 : 2);
  }
  return out;
}

/** Per-portion values (serving_grams unknown) — kept as-is. */
function perPortionValues(c: AiItem): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const f of NUMERIC_FIELDS) {
    const v = c[f];
    out[f] = v == null ? null : round(v, f === "calories" ? 0 : 2);
  }
  return out;
}

function rowToProfile(row: typeof foodProfiles.$inferSelect): FoodProfile {
  return {
    id: row.id,
    name: row.canonical_name,
    brand: row.brand,
    preparation: row.preparation,
    base_grams: row.base_grams,
    source: row.source,
    provider: row.provider,
    confidence: row.confidence,
    nova_alignment: row.nova_alignment,
    calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat,
    sugar: row.sugar, fiber: row.fiber, category: row.category, nova_group: row.nova_group,
    saturated_fat: row.saturated_fat, monounsaturated_fat: row.monounsaturated_fat,
    polyunsaturated_fat: row.polyunsaturated_fat, omega_3: row.omega_3, omega_6: row.omega_6,
    trans_fat: row.trans_fat, cholesterol: row.cholesterol, sodium: row.sodium,
    animal_protein: row.animal_protein, vegetal_protein: row.vegetal_protein,
    alcohol: row.alcohol,
    carne_lavorata: i2b(row.carne_lavorata), carne_rossa: i2b(row.carne_rossa),
    alcol: i2b(row.alcol), pesce_alto_mercurio: i2b(row.pesce_alto_mercurio),
    additivi: i2b(row.additivi),
  } as FoodProfile;
}

/**
 * Find an existing profile by canonical name (case-insensitive) + preparation,
 * or create one. On create, values are normalized to per-100 g when the AI
 * supplied serving_grams, otherwise kept per-portion (base_grams = null).
 */
export async function resolveOrCreateProfile(c: AiItem): Promise<FoodProfile> {
  const name = c.name.trim();
  const prep = c.cooking_method ?? null;

  const existing = await db
    .select()
    .from(foodProfiles)
    .where(
      sql`${foodProfiles.canonical_name} COLLATE NOCASE = ${name} AND COALESCE(${foodProfiles.preparation}, '') = ${prep ?? ""}`
    )
    .limit(1);

  if (existing.length > 0) return rowToProfile(existing[0]);

  const hasGrams = c.serving_grams != null && c.serving_grams > 0;
  const base_grams = hasGrams ? 100 : null;
  const values = hasGrams ? per100Values(c, c.serving_grams as number) : perPortionValues(c);
  const nova_alignment =
    c.nova_group != null ? (c.nova_group <= 2 ? 1 : 0) : null;

  const [row] = await db
    .insert(foodProfiles)
    .values({
      canonical_name: name,
      brand: null,
      preparation: prep,
      base_grams,
      source: "ai",
      provider: "gemini",
      confidence: computeConfidence(c),
      nova_alignment,
      calories: values.calories as number | null,
      protein: values.protein as number | null,
      carbs: values.carbs as number | null,
      fat: values.fat as number | null,
      sugar: values.sugar as number | null,
      fiber: values.fiber as number | null,
      category: c.category,
      nova_group: c.nova_group,
      saturated_fat: values.saturated_fat as number | null,
      monounsaturated_fat: values.monounsaturated_fat as number | null,
      polyunsaturated_fat: values.polyunsaturated_fat as number | null,
      omega_3: values.omega_3 as number | null,
      omega_6: values.omega_6 as number | null,
      trans_fat: values.trans_fat as number | null,
      cholesterol: values.cholesterol as number | null,
      sodium: values.sodium as number | null,
      animal_protein: values.animal_protein as number | null,
      vegetal_protein: values.vegetal_protein as number | null,
      alcohol: values.alcohol as number | null,
      carne_lavorata: b2i(c.carne_lavorata),
      carne_rossa: b2i(c.carne_rossa),
      pesce_alto_mercurio: b2i(c.pesce_alto_mercurio),
      additivi: b2i(c.additivi),
      alcol: b2i(c.alcol),
    })
    .returning();

  return rowToProfile(row);
}

/**
 * Scale a profile's per-100 g (or per-portion) nutrients by the portion factor
 * and build the immutable entry snapshot. Nulls stay null.
 */
function buildEntryValues(
  profile: FoodProfile,
  foodProfileId: number,
  name: string,
  queryText: string,
  targetGrams: number | null,
  factor: number,
  date: string
) {
  const scaled: Record<string, number | null> = {};
  for (const f of NUMERIC_FIELDS) {
    const v = (profile as unknown as Record<string, number | null>)[f];
    scaled[`calculated_${f}`] = v == null ? null : round(v * factor, f === "calories" ? 0 : 2);
  }
  return {
    user_id: "local",
    food_profile_id: foodProfileId,
    query_text: queryText,
    name,
    requested_grams: targetGrams,
    calculated_calories: scaled.calculated_calories as number | null,
    calculated_protein: scaled.calculated_protein as number | null,
    calculated_carbs: scaled.calculated_carbs as number | null,
    calculated_fat: scaled.calculated_fat as number | null,
    calculated_sugar: scaled.calculated_sugar as number | null,
    calculated_fiber: scaled.calculated_fiber as number | null,
    calculated_category: profile.category,
    calculated_nova_group: profile.nova_group,
    calculated_saturated_fat: scaled.calculated_saturated_fat as number | null,
    calculated_monounsaturated_fat: scaled.calculated_monounsaturated_fat as number | null,
    calculated_polyunsaturated_fat: scaled.calculated_polyunsaturated_fat as number | null,
    calculated_omega_3: scaled.calculated_omega_3 as number | null,
    calculated_omega_6: scaled.calculated_omega_6 as number | null,
    calculated_trans_fat: scaled.calculated_trans_fat as number | null,
    calculated_cholesterol: scaled.calculated_cholesterol as number | null,
    calculated_sodium: scaled.calculated_sodium as number | null,
    calculated_animal_protein: scaled.calculated_animal_protein as number | null,
    calculated_vegetal_protein: scaled.calculated_vegetal_protein as number | null,
    calculated_alcohol: scaled.calculated_alcohol as number | null,
    calculated_carne_lavorata: b2i(profile.carne_lavorata),
    calculated_carne_rossa: b2i(profile.carne_rossa),
    calculated_pesce_alto_mercurio: b2i(profile.pesce_alto_mercurio),
    calculated_additivi: b2i(profile.additivi),
    calculated_alcol: b2i(profile.alcol),
    calculated_base_grams: profile.base_grams,
    cooking_method: profile.preparation,
    logged_at: date,
  };
}

export interface CreatedEntry {
  id: number;
  name: string;
  grams: number | null;
  calories: number | null;
}

/**
 * Run the full pipeline for one user insertion and record one entry per
 * component. `getAiItems` performs the (cached-or-fresh) AI step.
 */
/**
 * Steps 1-3: obtain the AI components — a cache hit, or a fresh Gemini call
 * (whose result is stored in food_cache). The cache is skipped for an empty
 * key (e.g. an image with no note). Shared by the preview and the insertion
 * so a preview never doubles the AI work on the subsequent "Aggiungi".
 */
async function getComponents(
  key: string,
  getAiItems: () => Promise<AiItem[]>
): Promise<AiItem[]> {
  if (key !== "") {
    const rows = await db
      .select()
      .from(foodCache)
      .where(eq(foodCache.normalized_query, key));
    if (rows.length > 0) return rows.map(cacheRowToAiItem);
  }

  const components = await getAiItems();
  if (key !== "" && components.length > 0) {
    for (const c of components) {
      await db.insert(foodCache).values(aiItemToCache(key, c));
    }
  }
  return components;
}

// Exported (not just for testing): the full pipeline with an injectable AI
// step, so the cache/profile/scaling behavior can be exercised deterministically
// (scripts/verify-scale.ts) without contacting Gemini.
export async function runPipeline(
  originalQuery: string,
  date: string,
  key: string,
  grams: number | null,
  getAiItems: () => Promise<AiItem[]>
): Promise<CreatedEntry[]> {
  const components = await getComponents(key, getAiItems);

  // 4-5. Resolve profile + record entry for each component.
  const totalServing = components.reduce((s, c) => s + (c.serving_grams ?? 0), 0);
  const created: CreatedEntry[] = [];

  for (const comp of components) {
    const profile = await resolveOrCreateProfile(comp);

    let targetGrams: number | null;
    if (grams != null) {
      if (components.length === 1) {
        targetGrams = grams;
      } else if (comp.serving_grams != null && totalServing > 0) {
        targetGrams = round(grams * (comp.serving_grams / totalServing), 1);
      } else {
        targetGrams = null; // this component has no AI gram estimate
      }
    } else {
      targetGrams = comp.serving_grams;
    }

    const factor =
      profile.base_grams != null && targetGrams != null
        ? targetGrams / profile.base_grams
        : 1;

    const vals = buildEntryValues(
      profile, profile.id, profile.name,
      originalQuery, targetGrams, factor, date
    );
    const [row] = await db.insert(userFoodEntries).values(vals).returning({ id: userFoodEntries.id });
    created.push({
      id: row.id,
      name: profile.name,
      grams: targetGrams,
      calories: vals.calculated_calories,
    });
  }

  return created;
}

/**
 * Handle a text insertion. Extracts the quantity before the AI call.
 */
export async function createEntriesFromText(
  queryText: string,
  date: string
): Promise<CreatedEntry[]> {
  const { grams, rest } = parseQuantity(queryText);
  const key = normalizeQuery(rest);
  if (key === "") {
    throw new Error("Descrizione non valida.");
  }
  return runPipeline(queryText, date, key, grams, async () => {
    const { lookupNutritionFromText } = await import("./gemini");
    return lookupNutritionFromText(rest);
  });
}

/**
 * Handle an image insertion. The note is parsed for a quantity too; when the
 * note is empty the cache is skipped (a photo has no deterministic text key).
 */
export async function createEntriesFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  note: string | undefined,
  date: string
): Promise<CreatedEntry[]> {
  const originalQuery = note && note.trim() ? note.trim() : "(foto)";
  const { grams, rest } = parseQuantity(note ?? "");
  const key = normalizeQuery(rest);
  return runPipeline(originalQuery, date, key, grams, async () => {
    const { lookupNutritionFromImage } = await import("./gemini");
    return lookupNutritionFromImage(imageBuffer, mimeType, rest || undefined);
  });
}

/**
 * Text preview (UI "Aggiungi" flow): run the cache/AI step and return the
 * items for display, saving NO profiles and NO entries. A later
 * createEntriesFromText call hits the food_cache written here (zero extra AI).
 */
export async function previewFromText(queryText: string): Promise<AiItem[]> {
  const { rest } = parseQuantity(queryText);
  const key = normalizeQuery(rest);
  if (key === "") {
    throw new Error("Descrizione non valida.");
  }
  return getComponents(key, async () => {
    const { lookupNutritionFromText } = await import("./gemini");
    return lookupNutritionFromText(rest);
  });
}

/**
 * Image preview (UI "Aggiungi" flow): same contract as previewFromText.
 * With an empty note the cache key is empty, so each preview without a note
 * goes straight to the AI (a photo has no deterministic text key).
 */
export async function previewFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  note: string | undefined
): Promise<AiItem[]> {
  const { rest } = parseQuantity(note ?? "");
  const key = normalizeQuery(rest);
  return getComponents(key, async () => {
    const { lookupNutritionFromImage } = await import("./gemini");
    return lookupNutritionFromImage(imageBuffer, mimeType, rest || undefined);
  });
}
