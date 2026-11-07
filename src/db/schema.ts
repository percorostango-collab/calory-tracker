import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const foods = sqliteTable("foods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  calories: integer("calories").notNull(),
  protein: real("protein").notNull(),
  carbs: real("carbs").notNull(),
  fat: real("fat").notNull(),
  servingSize: text("servingSize").notNull(),
});

export const foodLog = sqliteTable("food_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  foodId: integer("foodId").notNull().references(() => foods.id),
  servings: real("servings").notNull().default(1),
  loggedAt: text("loggedAt").notNull(), // ISO date string "YYYY-MM-DD"
});
