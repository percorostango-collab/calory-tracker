import { SchemaType } from "@google/generative-ai";
import type { ObjectSchema, ArraySchema } from "@google/generative-ai";

/**
 * Fixed list of Italian food categories the model must choose from.
 * Kept in the health layer so it is portable to the mobile version.
 */
export const FOOD_CATEGORIES = [
  "Frutta",
  "Verdura",
  "Cereali e tuberi",
  "Legumi",
  "Carne e salumi",
  "Pesce e crostacei",
  "Uova",
  "Latticini",
  "Frutta secca e semi",
  "Oli e grassi",
  "Zuccheri e dolcificanti",
  "Prodotti da forno",
  "Prodotti trasformati",
  "Bevande",
  "Altro",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/**
 * JSON schema for a single food item returned by Gemini.
 * Core fields (name, calories, protein, carbs, fat) are required; the health
 * fields and servingSize/serving_grams are nullable and must be null when
 * unknown. Values are reported for the portion as described (the backend
 * does any per-100 g normalization).
 */
export const foodItemSchema: ObjectSchema = {
  description: "A single nutrition entry for a food item.",
  type: SchemaType.OBJECT,
  properties: {
    name: {
      type: SchemaType.STRING,
      description: "Name of the food in Italian (e.g., 'Pollo alla griglia').",
    },
    calories: {
      type: SchemaType.NUMBER,
      description: "Total calories in the portion as described.",
    },
    protein: {
      type: SchemaType.NUMBER,
      description: "Total protein in grams.",
    },
    carbs: {
      type: SchemaType.NUMBER,
      description: "Total carbohydrates in grams.",
    },
    fat: {
      type: SchemaType.NUMBER,
      description: "Total fat in grams.",
    },
    sugar: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Total sugars in grams. Use null if not determinable.",
    },
    fiber: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Total dietary fiber in grams. Use null if not determinable.",
    },
    saturated_fat: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Saturated fats in grams. Use null if not determinable.",
    },
    monounsaturated_fat: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Monounsaturated fats in grams. Use null if not determinable.",
    },
    polyunsaturated_fat: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Polyunsaturated fats in grams. Use null if not determinable.",
    },
    omega_3: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Omega-3 fatty acids in grams. Use null if not determinable.",
    },
    omega_6: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Omega-6 fatty acids in grams. Use null if not determinable.",
    },
    trans_fat: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Trans fats in grams. Use null if not determinable.",
    },
    cholesterol: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Cholesterol in mg. Use null if not determinable.",
    },
    sodium: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Sodium in mg. Use null if not determinable.",
    },
    animal_protein: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Grams of animal protein. Use null if not determinable.",
    },
    vegetal_protein: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Grams of vegetal protein. Use null if not determinable.",
    },
    alcohol: {
      type: SchemaType.NUMBER,
      nullable: true,
      description: "Alcohol in grams. Use null if not determinable.",
    },
    category: {
      type: SchemaType.STRING,
      nullable: true,
      description: `Main food category in Italian. Must be one of: ${FOOD_CATEGORIES.join(", ")}. Use null if not determinable.`,
    },
    nova_group: {
      type: SchemaType.NUMBER,
      nullable: true,
      description:
        "NOVA processing classification: 1 (unprocessed/minimally processed), 2 (culinary ingredient), 3 (processed), 4 (ultra-processed). Use null if not determinable.",
    },
    cooking_method: {
      type: SchemaType.STRING,
      nullable: true,
      description:
        "Cooking method detected or typical for this item, in Italian lowercase (e.g., 'grigliato', 'fritto', 'bollito', 'al forno', 'cru'). Use null if not applicable or not determinable.",
    },
    servingSize: {
      type: SchemaType.STRING,
      nullable: true,
      description:
        "Human-readable serving size in Italian (e.g., '1 piatto', '200g'). Use null if not determinable.",
    },
    serving_grams: {
      type: SchemaType.NUMBER,
      nullable: true,
      description:
        "Total estimated grams of this item in the portion described. Use null if not determinable.",
    },
    // Boolean flags for easy scoring
    carne_lavorata: {
      type: SchemaType.BOOLEAN,
      nullable: true,
      description: "True if it is processed meat (e.g., ham, sausage).",
    },
    carne_rossa: {
      type: SchemaType.BOOLEAN,
      nullable: true,
      description: "True if it is red meat.",
    },
    alcol: {
      type: SchemaType.BOOLEAN,
      nullable: true,
      description: "True if the item contains alcohol.",
    },
    pesce_alto_mercurio: {
      type: SchemaType.BOOLEAN,
      nullable: true,
      description: "True if it is a fish known for high mercury content.",
    },
    additivi: {
      type: SchemaType.BOOLEAN,
      nullable: true,
      description: "True if it contains known food additives (highly processed).",
    },
  },
  required: ["name", "calories", "protein", "carbs", "fat"],
};

/**
 * Top-level schema: array of food items.
 */
export const nutritionSchema: ArraySchema = {
  description:
    "A list of individual food items or ingredients found in the described meal or photo.",
  type: SchemaType.ARRAY,
  items: foodItemSchema,
};

/**
 * Prompt preamble sent with every lookup (text and image).
 * Lives here so the mobile version can reuse the exact same prompt.
 */
export const NUTRITIONIST_PREAMBLE =
  "You are a professional nutritionist. Your task is to analyze food descriptions or images. " +
  "IMPORTANT: Always respond in ITALIAN. " +
  "If the input is a complex meal (e.g., 'steak with salad and potatoes'), break it down into its individual components (e.g., 'Bistecca', 'Insalata', 'Patate') and return them as separate items in the list. " +
  "Each item must have its own nutritional estimation. " +
  "For each item also estimate the health fields when possible: " +
  "sugar, fiber, saturated_fat, monounsaturated_fat, polyunsaturated_fat, omega_3, omega_6, trans_fat, cholesterol, sodium, animal_protein, vegetal_protein, alcohol, " +
  "category (one of: " + FOOD_CATEGORIES.join(", ") + "), " +
  "nova_group (1-4), cooking_method, servingSize and serving_grams, and flags (carne_lavorata, carne_rossa, alcol, pesce_alto_mercurio, additivi). " +
  "Report all values for the portion as described; NEVER normalize to 100 g yourself. " +
  "If a field is not determinable, set it to null. " +
  "Ensure values are physically possible (e.g., saturated_fat <= fat, sugar <= carbs). " +
  "Return ONLY a JSON array of objects.";
