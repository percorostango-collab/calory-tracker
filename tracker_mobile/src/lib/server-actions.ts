import { foods, foodLog } from "../db/schema";
import { and, eq, like } from "drizzle-orm";
import { db } from "../db";
import type { Food, NewFood } from "../lib/types";

export async function getFoods(query: string): Promise<Food[]> {
  if (!query) return [];
  return await db
    .select()
    .from(foods)
    .where(like(foods.name, `%${query}%`))
    .limit(10);
}

export async function getDailyLog(userId: string, date: string) {
  const entries = await db
    .select({
      id: foodLog.id,
      servings: foodLog.servings,
      loggedAt: foodLog.loggedAt,
      food: foods,
    })
    .from(foodLog)
    .innerJoin(foods, eq(foodLog.foodId, foods.id))
    .where(and(eq(foodLog.userId, userId), eq(foodLog.loggedAt, date)));

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

export async function addLogEntry(
  userId: string,
  foodId: number,
  servings: number,
  date: string
) {
  await db.insert(foodLog).values({
    userId,
    foodId,
    servings,
    loggedAt: date,
  });
}

export async function removeLogEntry(userId: string, id: number) {
  await db
    .delete(foodLog)
    .where(and(eq(foodLog.id, id), eq(foodLog.userId, userId)));
}

export async function clearDailyLog(userId: string, date: string) {
  await db
    .delete(foodLog)
    .where(and(eq(foodLog.userId, userId), eq(foodLog.loggedAt, date)));
}

/**
 * Upserts a food item by name and returns its ID.
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

  const [newFood] = await db
    .insert(foods)
    .values(food)
    .returning({ id: foods.id });

  return newFood.id;
}
