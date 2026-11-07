import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { NewFood } from "@/lib/types";

const MODEL_NAME = "gemini-3.5-flash-lite";

/**
 * Error with an HTTP status code, so API routes can map failures directly.
 */
export class GeminiError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = "GeminiError";
  }
}

import type { GenerativeModel, ObjectSchema, ArraySchema } from "@google/generative-ai";

/**
 * JSON schema enforcing the exact shape we expect from the model.
 */
const foodItemSchema: ObjectSchema = {
  description: "A single nutrition entry for a food item.",
  type: SchemaType.OBJECT,
  properties: {
    name: {
      type: SchemaType.STRING,
      description: "Name of the food in Italian (e.g., 'Pollo alla griglia').",
    },
    calories: {
      type: SchemaType.NUMBER,
      description: "Total calories in the serving.",
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
    servingSize: {
      type: SchemaType.STRING,
      description:
        "Human-readable serving size in Italian (e.g., '1 piatto', '200g').",
    },
  },
  required: ["name", "calories", "protein", "carbs", "fat", "servingSize"],
};

const nutritionSchema: ArraySchema = {
  description:
    "A list of individual food items or ingredients found in the described meal or photo.",
  type: SchemaType.ARRAY,
  items: foodItemSchema,
};

let modelInstance: GenerativeModel | undefined;

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError(
      "GEMINI_API_KEY is not set. Add it to the .env file.",
      401
    );
  }
  if (!modelInstance) {
    const genAI = new GoogleGenerativeAI(apiKey);
    modelInstance = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: nutritionSchema,
      },
    });
  }
  return modelInstance;
}

/**
 * Validates the raw model output and normalizes it into NewFood[].
 */
function parseFoodResponse(raw: unknown): NewFood[] {
  if (!Array.isArray(raw)) {
    throw new GeminiError("AI returned an invalid response format. Expected an array.", 502);
  }

  const isFiniteNumber = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;

  return raw.map((item: any) => {
    const { name, calories, protein, carbs, fat, servingSize } = item;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !isFiniteNumber(calories) ||
      !isFiniteNumber(protein) ||
      !isFiniteNumber(carbs) ||
      !isFiniteNumber(fat) ||
      typeof servingSize !== "string" ||
      !servingSize.trim()
    ) {
      throw new GeminiError("AI returned incomplete or invalid nutrition data in one of the items.", 502);
    }

    return {
      name: name.trim(),
      calories: Math.round(calories as number),
      protein: parseFloat((protein as number).toFixed(1)),
      carbs: parseFloat((carbs as number).toFixed(1)),
      fat: parseFloat((fat as number).toFixed(1)),
      servingSize: servingSize.trim(),
    };
  });
}

/** Maps SDK-level failures to user-facing errors with status codes. */
function toGeminiError(error: unknown): GeminiError {
  const msg =
    error instanceof Error ? error.message : String(error ?? "unknown error");
  const lower = msg.toLowerCase();

  if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
    return new GeminiError("Gemini API key is invalid.", 401);
  }
  if (lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("429")) {
    return new GeminiError("Gemini API quota or rate limit exceeded. Try again later.", 429);
  }
  if (lower.includes("safety") || lower.includes("blocked")) {
    return new GeminiError("Content was blocked by Gemini safety filters.", 422);
  }
  return new GeminiError("Failed to reach Gemini. Please try again.", 502);
}

const NUTRITIONIST_PREAMBLE =
  "You are a professional nutritionist. Your task is to analyze food descriptions or images. " +
  "IMPORTANT: Always respond in ITALIAN. " +
  "If the input is a complex meal (e.g., 'steak with salad and potatoes'), break it down into its individual components (e.g., 'Bistecca', 'Insalata', 'Patate') and return them as separate items in the list. " +
  "Each item must have its own nutritional estimation. " +
  "Return ONLY a JSON array of objects.";

/**
 * Estimates nutrition from a text description.
 */
export async function lookupNutritionFromText(description: string): Promise<NewFood[]> {
  if (!description.trim()) {
    throw new GeminiError("Description cannot be empty.", 400);
  }

  const model = getModel();
  try {
    const result = await model.generateContent(
      `${NUTRITIONIST_PREAMBLE}\n\nDescription: "${description}"`
    );
    const text = result.response.text();
    return parseFoodResponse(JSON.parse(text));
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    throw toGeminiError(error);
  }
}

/**
 * Estimates nutrition from a photo of the meal.
 * @param imageBuffer raw image bytes
 * @param mimeType    e.g. "image/jpeg"
 * @param note        optional extra context from the user
 */
export async function lookupNutritionFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  note?: string
): Promise<NewFood[]> {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new GeminiError("No image data provided.", 400);
  }

  const model = getModel();
  try {
    const prompt =
      `${NUTRITIONIST_PREAMBLE}\n\n` +
      (note ? `Additional context: "${note}"\n\n` : "") +
      "Analyze the attached photo of the food and list all individual components.";
    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
    ]);
    const text = result.response.text();
    return parseFoodResponse(JSON.parse(text));
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    throw toGeminiError(error);
  }
}
