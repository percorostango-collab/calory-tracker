import { NextResponse } from "next/server";
import { lookupNutritionFromText, GeminiError } from "@shared/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { description } = body;

    if (typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "Description is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    if (description.length > 500) {
      return NextResponse.json(
        { error: "Description must be 500 characters or less." },
        { status: 400 }
      );
    }

    const nutrition = await lookupNutritionFromText(description);
    return NextResponse.json(nutrition);
  } catch (error: unknown) {
    if (error instanceof GeminiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("API Nutrition Text Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
