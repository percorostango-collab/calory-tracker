import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const foods = sqliteTable("foods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  calories: integer("calories").notNull(),
  protein: real("protein").notNull(),
  carbs: real("carbs").notNull(),
  fat: real("fat").notNull(),
  servingSize: text("servingSize").notNull(),
  sugar: real("sugar"),
  fiber: real("fiber"),
  category: text("category"),
  nova_group: integer("nova_group"),
  is_healthy_flag: integer("is_healthy_flag"),
  source: text("source"),
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
});

export const foodLog = sqliteTable("food_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  foodId: integer("foodId").notNull().references(() => foods.id),
  servings: real("servings").notNull().default(1),
  loggedAt: text("loggedAt").notNull(), // ISO date string "YYYY-MM-DD"
  cooking_method: text("cooking_method"),
});

export const userSettings = sqliteTable("user_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weight: real("weight"),
  gender: text("gender"),
  age: integer("age"),
});
