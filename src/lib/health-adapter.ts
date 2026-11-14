import { eq } from "drizzle-orm";
import { db } from "../db";
import { userFoodEntries, foodProfiles } from "../db/schema";
import type { Nutrition } from "./types";
import type { HealthEntry } from "./health/types";

/**
 * Bridge between the SQLite DB and the pure health engine.
 * This file is intentionally OUTSIDE src/lib/health/ because it depends
 * on the database layer; the health engine itself stays framework-free.
 *
 * Mapping (engine contract): `food` holds the PROFILE's per-100 g (or
 * per-portion) values and `servings` holds the entry's portion factor
 * (requested_grams / base_grams, 1 for per-portion entries). The engine
 * multiplies `food.x * servings`, which reproduces exactly the entry's
 * immutable `calculated_*` snapshot. Flags are normalized 0/1/null ->
 * boolean|null because the engine scores with `=== true` / `== null`.
 */
export async function getHealthEntries(date: string): Promise<HealthEntry[]> {
  const rows = await db
    .select({
      id: userFoodEntries.id,
      factor_base: userFoodEntries.calculated_base_grams,
      requested_grams: userFoodEntries.requested_grams,
      logged_at: userFoodEntries.logged_at,
      cooking_method: userFoodEntries.cooking_method,
      name: userFoodEntries.name,
      food: foodProfiles,
    })
    .from(userFoodEntries)
    .innerJoin(
      foodProfiles,
      eq(userFoodEntries.food_profile_id, foodProfiles.id)
    )
    .where(eq(userFoodEntries.logged_at, date));

  const i2b = (n: number | null): boolean | null =>
    n == null ? null : n === 1;

  return rows.map((row) => {
    const p = row.food;
    const servings =
      p.base_grams != null && row.requested_grams != null
        ? row.requested_grams / p.base_grams
        : 1;

    const food: Nutrition = {
      name: row.name ?? p.canonical_name,
      calories: p.calories,
      protein: p.protein,
      carbs: p.carbs,
      fat: p.fat,
      sugar: p.sugar,
      fiber: p.fiber,
      category: p.category,
      nova_group: p.nova_group,
      saturated_fat: p.saturated_fat,
      monounsaturated_fat: p.monounsaturated_fat,
      polyunsaturated_fat: p.polyunsaturated_fat,
      omega_3: p.omega_3,
      omega_6: p.omega_6,
      trans_fat: p.trans_fat,
      cholesterol: p.cholesterol,
      sodium: p.sodium,
      animal_protein: p.animal_protein,
      vegetal_protein: p.vegetal_protein,
      alcohol: p.alcohol,
      carne_lavorata: i2b(p.carne_lavorata),
      carne_rossa: i2b(p.carne_rossa),
      alcol: i2b(p.alcol),
      pesce_alto_mercurio: i2b(p.pesce_alto_mercurio),
      additivi: i2b(p.additivi),
    };

    return {
      id: row.id,
      servings,
      loggedAt: row.logged_at,
      cooking_method: row.cooking_method,
      cooking_source: row.cooking_method == null ? "unknown" : "ai",
      source: p.source ?? "ai",
      provider: p.provider ?? null,
      food,
    };
  });
}
