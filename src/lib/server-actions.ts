import { foods, foodLog, userSettings } from "../db/schema";
import { eq, like } from "drizzle-orm";
import { db } from "../db";
import type { Food, NewFood } from "./types";
import type { HealthEntry } from "./health/types";

export async function getFoods(query: string): Promise<Food[]> {
  if (!query) return [];
  return await db
    .select()
    .from(foods)
    .where(like(foods.name, `%${query}%`))
    .limit(10);
}

export async function getDailyLog(date: string) {
  const entries = await db
    .select({
      id: foodLog.id,
      servings: foodLog.servings,
      loggedAt: foodLog.loggedAt,
      food: foods,
    })
    .from(foodLog)
    .innerJoin(foods, eq(foodLog.foodId, foods.id))
    .where(eq(foodLog.loggedAt, date));

  const totals = entries.reduce(
    (acc, entry) => {
      acc.calories += entry.food.calories * entry.servings;
      acc.protein += entry.food.protein * entry.servings;
      acc.carbs += entry.food.carbs * entry.servings;
      acc.fat += entry.food.fat * entry.servings;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return { entries, totals };
}

export async function addLogEntry(foodId: number, servings: number, date: string, cookingMethod?: string | null) {
  await db.insert(foodLog).values({
    foodId,
    servings,
    loggedAt: date,
    cooking_method: cookingMethod,
  });
}

export async function removeLogEntry(id: number) {
  await db.delete(foodLog).where(eq(foodLog.id, id));
}

export async function clearDailyLog(date: string) {
  await db.delete(foodLog).where(eq(foodLog.loggedAt, date));
}

/**
 * Upserts a food item by name and returns its ID.
 * Now includes new health-related fields.
 */
export async function upsertFood(food: NewFood): Promise<number> {
  const existing = await db
    .select({ id: foods.id })
    .from(foods)
    .where(eq(foods.name, food.name))
    .limit(1)
    .then((res) => res[0]);

  if (existing) {
    return existing.id;
  }

  // Health flag derived from NOVA at insert time: 1-2 -> 1, 3-4 -> 0, unknown -> null.
  // cooking_method is intentionally NOT written to foods (it belongs to food_log).
  const is_healthy_flag = food.nova_group == null ? null : food.nova_group <= 2 ? 1 : 0;

  const [newFood] = await db
    .insert(foods)
    .values({
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      servingSize: food.servingSize,
      sugar: food.sugar,
      fiber: food.fiber,
      category: food.category,
      nova_group: food.nova_group,
      is_healthy_flag,
      source: "ai",
    })
    .returning({ id: foods.id });

  return newFood.id;
}

/**
 * Bridge between the SQLite DB and the pure health engine.
 * The health engine itself stays framework-free in src/lib/health/.
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
