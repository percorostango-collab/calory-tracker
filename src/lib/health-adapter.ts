import { eq } from "drizzle-orm";
import { db } from "../db";
import { foods, foodLog } from "../db/schema";
import type { Food } from "./types";
import type { HealthEntry } from "./health/types";

/**
 * Bridge between the SQLite DB and the pure health engine.
 * This file is intentionally OUTSIDE src/lib/health/ because it depends
 * on the database layer; the health engine itself stays framework-free.
 */
export async function getHealthEntries(date: string): Promise<HealthEntry[]> {
  const rows = await db
    .select({
      id: foodLog.id,
      servings: foodLog.servings,
      loggedAt: foodLog.loggedAt,
      cooking_method: foodLog.cooking_method,
      food: foods,
    })
    .from(foodLog)
    .innerJoin(foods, eq(foodLog.foodId, foods.id))
    .where(eq(foodLog.loggedAt, date));

  return rows.map((row) => ({
    id: row.id,
    servings: row.servings,
    loggedAt: row.loggedAt,
    cooking_method: row.cooking_method,
    // Drizzle result rows match the Food interface structurally.
    food: row.food as unknown as Food,
  }));
}
