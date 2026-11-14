import { userFoodEntries } from "../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";
import type { DailyLogData, FoodEntry } from "./types";

/**
 * Server actions for the diary (user_food_entries).
 *
 * Entries are self-contained snapshots: the `calculated_*` fields already
 * carry the scaled values, so reading the day is a flat select with no join
 * and NO `×servings` multiplication. Missing values stay null -> the UI
 * renders "dato non disponibile"; totals only sum the known values.
 */
export async function getDailyLog(date: string): Promise<DailyLogData> {
  const rows = await db
    .select({
      id: userFoodEntries.id,
      name: userFoodEntries.name,
      query_text: userFoodEntries.query_text,
      requested_grams: userFoodEntries.requested_grams,
      calculated_calories: userFoodEntries.calculated_calories,
      calculated_protein: userFoodEntries.calculated_protein,
      calculated_carbs: userFoodEntries.calculated_carbs,
      calculated_fat: userFoodEntries.calculated_fat,
      logged_at: userFoodEntries.logged_at,
    })
    .from(userFoodEntries)
    .where(eq(userFoodEntries.logged_at, date))
    .orderBy(userFoodEntries.id);

  const entries: FoodEntry[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    query_text: r.query_text,
    requested_grams: r.requested_grams,
    calculated_calories: r.calculated_calories,
    calculated_protein: r.calculated_protein,
    calculated_carbs: r.calculated_carbs,
    calculated_fat: r.calculated_fat,
    logged_at: r.logged_at,
  }));

  const totals = entries.reduce(
    (acc, e) => {
      acc.calories += e.calculated_calories ?? 0;
      acc.protein += e.calculated_protein ?? 0;
      acc.carbs += e.calculated_carbs ?? 0;
      acc.fat += e.calculated_fat ?? 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return { entries, totals };
}

export async function removeLogEntry(id: number) {
  await db.delete(userFoodEntries).where(eq(userFoodEntries.id, id));
}

export async function clearDailyLog(date: string) {
  await db.delete(userFoodEntries).where(eq(userFoodEntries.logged_at, date));
}
