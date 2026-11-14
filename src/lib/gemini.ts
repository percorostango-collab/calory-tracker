import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerativeModel } from "@google/generative-ai";
import type { AiItem } from "./types";
import { nutritionSchema, NUTRITIONIST_PREAMBLE } from "./health/nutrition-schema";

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

/**
 * Error with an HTTP status code, so API routes can map failures directly.
 */
export class GeminiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public rawMessage?: string
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

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
 * Validates the raw model output and normalizes it into AiItem[].
 * Core fields (name, calories, protein, carbs, fat) are mandatory in the
 * response: missing/invalid core -> 502. servingSize and serving_grams are
 * nullable (serving_grams drives the per-100 g normalization downstream).
 * New health fields are optional: missing/invalid or physically impossible ->
 * null (never 502, never invented).
 */
export function parseFoodResponse(raw: unknown): AiItem[] {
  if (!Array.isArray(raw)) {
    throw new GeminiError("AI returned an invalid response format. Expected an array.", 502);
  }

  const isFiniteNumber = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;

  const round1 = (v: number) => parseFloat(v.toFixed(1));

  return raw.map((item: any) => {
    const { name, calories, protein, carbs, fat, servingSize } = item;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !isFiniteNumber(calories) ||
      !isFiniteNumber(protein) ||
      !isFiniteNumber(carbs) ||
      !isFiniteNumber(fat)
    ) {
      throw new GeminiError("AI returned incomplete or invalid nutrition data in one of the items.", 502);
    }

    // Numeric estimate of the described portion in grams; null if not
    // determinable (no sanity check beyond finiteness/positivity).
    const servingGrams =
      typeof item.serving_grams === "number" &&
      Number.isFinite(item.serving_grams) &&
      item.serving_grams > 0
        ? item.serving_grams
        : null;

    // New health fields: nullable, never invented (missing/invalid -> null, no 502)
    const sugar = isFiniteNumber(item.sugar) ? round1(item.sugar) : null;
    const fiber = isFiniteNumber(item.fiber) ? round1(item.fiber) : null;
    const saturatedFat = isFiniteNumber(item.saturated_fat) ? round1(item.saturated_fat) : null;
    const monounsaturatedFat = isFiniteNumber(item.monounsaturated_fat) ? round1(item.monounsaturated_fat) : null;
    const polyunsaturatedFat = isFiniteNumber(item.polyunsaturated_fat) ? round1(item.polyunsaturated_fat) : null;
    const omega3 = isFiniteNumber(item.omega_3) ? round1(item.omega_3) : null;
    const omega6 = isFiniteNumber(item.omega_6) ? round1(item.omega_6) : null;
    const transFat = isFiniteNumber(item.trans_fat) ? round1(item.trans_fat) : null;
    const cholesterol = isFiniteNumber(item.cholesterol) ? round1(item.cholesterol) : null;
    const sodium = isFiniteNumber(item.sodium) ? round1(item.sodium) : null;
    const animalProtein = isFiniteNumber(item.animal_protein) ? round1(item.animal_protein) : null;
    const vegetalProtein = isFiniteNumber(item.vegetal_protein) ? round1(item.vegetal_protein) : null;
    const alcohol = isFiniteNumber(item.alcohol) ? round1(item.alcohol) : null;

    // Sanity checks: discard physically impossible values (never invented -> null).
    const finalSugar = sugar !== null && sugar > carbs ? null : sugar;
    const finalSaturatedFat = saturatedFat !== null && saturatedFat > fat ? null : saturatedFat;
    const finalMonounsaturatedFat = monounsaturatedFat !== null && monounsaturatedFat > fat ? null : monounsaturatedFat;
    const finalPolyunsaturatedFat = polyunsaturatedFat !== null && polyunsaturatedFat > fat ? null : polyunsaturatedFat;
    const finalTransFat = transFat !== null && transFat > fat ? null : transFat;

    let finalAnimalProtein = animalProtein;
    let finalVegetalProtein = vegetalProtein;
    if (
      finalAnimalProtein !== null &&
      finalVegetalProtein !== null &&
      finalAnimalProtein + finalVegetalProtein > protein + 0.05
    ) {
      finalAnimalProtein = null;
      finalVegetalProtein = null;
    } else if (finalAnimalProtein !== null && finalAnimalProtein > protein + 0.05) {
      finalAnimalProtein = null;
    } else if (finalVegetalProtein !== null && finalVegetalProtein > protein + 0.05) {
      finalVegetalProtein = null;
    }

    const boolOrNull = (v: unknown) => (typeof v === "boolean" ? v : null);

    return {
      name: name.trim(),
      calories: Math.round(calories),
      protein: round1(protein),
      carbs: round1(carbs),
      fat: round1(fat),
      servingSize: typeof servingSize === "string" && servingSize.trim() ? servingSize.trim() : null,
      serving_grams: servingGrams,
      sugar: finalSugar,
      fiber,
      saturated_fat: finalSaturatedFat,
      monounsaturated_fat: finalMonounsaturatedFat,
      polyunsaturated_fat: finalPolyunsaturatedFat,
      omega_3: omega3,
      omega_6: omega6,
      trans_fat: finalTransFat,
      cholesterol,
      sodium,
      animal_protein: finalAnimalProtein,
      vegetal_protein: finalVegetalProtein,
      alcohol,
      category: typeof item.category === "string" && item.category.trim() ? item.category : null,
      nova_group:
        typeof item.nova_group === "number" && item.nova_group >= 1 && item.nova_group <= 4
          ? item.nova_group
          : null,
      cooking_method:
        typeof item.cooking_method === "string" && item.cooking_method.trim()
          ? item.cooking_method.trim().toLowerCase()
          : null,
      carne_lavorata: boolOrNull(item.carne_lavorata),
      carne_rossa: boolOrNull(item.carne_rossa),
      alcol: boolOrNull(item.alcol),
      pesce_alto_mercurio: boolOrNull(item.pesce_alto_mercurio),
      additivi: boolOrNull(item.additivi),
    };
  });
}

/** Maps SDK-level failures to user-facing errors with status codes. Logs the full
 * raw error server-side (no secrets) so the real Gemini message is never lost. */
function toGeminiError(error: unknown): GeminiError {
  const msg =
    error instanceof Error ? error.message : String(error ?? "unknown error");
  const lower = msg.toLowerCase();

  // Full server-side log of the raw error (never print the API key).
  console.error("[Gemini] raw error:", JSON.stringify({ message: msg, error }));

  if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
    return new GeminiError("Gemini API key is invalid.", 401, msg);
  }
  if (lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("429")) {
    return new GeminiError("Gemini API quota or rate limit exceeded. Try again later.", 429, msg);
  }
  if (
    lower.includes("high demand") ||
    lower.includes("overloaded") ||
    lower.includes("503") ||
    lower.includes("try again later")
  ) {
    return new GeminiError("Gemini is temporarily overloaded. Please try again.", 503, msg);
  }
  if (lower.includes("safety") || lower.includes("blocked")) {
    return new GeminiError("Content was blocked by Gemini safety filters.", 422, msg);
  }
  return new GeminiError("Failed to reach Gemini. Please try again.", 502, msg);
}

/**
 * Executes a function with exponential backoff retry logic for specific Gemini errors.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
): Promise<T> {
  const delays = [1000, 2000, 4000];
  let lastError: any;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const isRetryable =
        error instanceof GeminiError &&
        (error.statusCode === 429 || error.statusCode === 503 || error.statusCode === 502);

      if (!isRetryable || i === attempts - 1) {
        throw error;
      }

      const delay = delays[i] ?? 1000;
      console.warn(`[Gemini] Retryable error detected (attempt ${i + 1}/${attempts}). Retrying in ${delay}ms... Error: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Estimates nutrition from a text description.
 */
export async function lookupNutritionFromText(description: string): Promise<AiItem[]> {
  if (!description.trim()) {
    throw new GeminiError("Description cannot be empty.", 400);
  }

  const model = getModel();
  // Retry covers the transport layer only; parsing errors are not retryable.
  const result = await withRetry(() =>
    model.generateContent(
      `${NUTRITIONIST_PREAMBLE}\n\nDescription: "${description}"`
    ),
  );
  const text = result.response.text();
  return parseFoodResponse(JSON.parse(text));
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
): Promise<AiItem[]> {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new GeminiError("No image data provided.", 400);
  }

  const model = getModel();
  // Retry covers the transport layer only; parsing errors are not retryable.
  const result = await withRetry(() =>
    model.generateContent([
      `${NUTRITIONIST_PREAMBLE}\n\n` +
        (note ? `Additional context: "${note}"\n\n` : "") +
        "Analyze the attached photo of the food and list all individual components.",
      { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
    ]),
  );
  const text = result.response.text();
  return parseFoodResponse(JSON.parse(text));
}
