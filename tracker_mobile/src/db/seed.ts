import { count } from "drizzle-orm";
import { foods } from "./schema";
import type { NewFood } from "../lib/types";

const COMMON_FOODS: NewFood[] = [
  { name: "Petto di Pollo", calories: 165, protein: 31, carbs: 0, fat: 3.6, servingSize: "100g" },
  { name: "Riso Bianco", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, servingSize: "1 tazza (cotto)" },
  { name: "Riso Integrale", calories: 111, protein: 2.6, carbs: 23, fat: 0.9, servingSize: "1 tazza (cotto)" },
  { name: "Riso Basmati", calories: 121, protein: 2.7, carbs: 25, fat: 0.3, servingSize: "1 tazza (cotto)" },
  { name: "Riso Jasmine", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, servingSize: "1 tazza (cotto)" },
  { name: "Uovo", calories: 70, protein: 6, carbs: 0.6, fat: 5, servingSize: "1 grande" },
  { name: "Banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3, servingSize: "1 media" },
  { name: "Avocado", calories: 160, protein: 2, carbs: 9, fat: 15, servingSize: "1/2 frutto" },
  { name: "Avena", calories: 389, protein: 16.9, carbs: 66, fat: 6.9, servingSize: "1 tazza" },
  { name: "Salmone", calories: 208, protein: 20, carbs: 0, fat: 13, servingSize: "100g" },
  { name: "Yogurt Greco", calories: 59, protein: 10, carbs: 3.6, fat: 0.4, servingSize: "100g" },
  { name: "Mandorle", calories: 579, protein: 21, carbs: 22, fat: 50, servingSize: "100g" },
  { name: "Patata Dolce", calories: 86, protein: 1.6, carbs: 20, fat: 0.1, servingSize: "100g" },
  { name: "Broccoli", calories: 34, protein: 2.8, carbs: 7, fat: 0.4, servingSize: "100g" },
  { name: "Burro d'Arachidi", calories: 588, protein: 25, carbs: 20, fat: 50, servingSize: "2 cucchiai" },
  { name: "Manzo", calories: 250, protein: 26, carbs: 0, fat: 15, servingSize: "100g" },
  { name: "Tofu", calories: 76, protein: 8, carbs: 1.9, fat: 4.8, servingSize: "100g" },
  { name: "Quinoa", calories: 120, protein: 4.4, carbs: 21, fat: 1.9, servingSize: "1 tazza (cotta)" },
  { name: "Mela", calories: 52, protein: 0.3, carbs: 14, fat: 0.2, servingSize: "1 media" },
  { name: "Spinaci", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, servingSize: "100g" },
  { name: "Lenticchie", calories: 116, protein: 8.9, carbs: 23.7, fat: 0.5, servingSize: "1 tazza (cotta)" },
  { name: "Formaggio Cheddar", calories: 403, protein: 25, carbs: 1.3, fat: 33, servingSize: "100g" },
  { name: "Olio d'Oliva", calories: 884, protein: 0, carbs: 0, fat: 100, servingSize: "1 cucchiaio" },
  { name: "Fagioli Neri", calories: 132, protein: 8.9, carbs: 23.7, fat: 0.5, servingSize: "1 tazza (cotta)" },
];

export async function seedFoods(db: any) {
  const countResult = await db.select({ value: count() }).from(foods);
  const foodCount = countResult[0]?.value ?? 0;

  if (foodCount < COMMON_FOODS.length) {
    console.log("Seeding foods...");
    await db
      .insert(foods)
      .values(COMMON_FOODS)
      .onConflictDoNothing({ target: foods.name });
    console.log("Seeding completed.");
  } else {
    console.log("Foods already seeded.");
  }
}
