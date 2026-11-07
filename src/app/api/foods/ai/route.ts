import { NextResponse } from "next/server";
import { upsertFood } from "@/lib/server-actions";
import type { NewFood } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const food = body as NewFood;

    if (!food.name || !food.calories || !food.servingSize) {
      return NextResponse.json(
        { error: "Invalid food data provided." },
        { status: 400 }
      );
    }

    const id = await upsertFood(food);
    return NextResponse.json({ id });
  } catch (error: any) {
    console.error("API AI Food Upsert Error:", error);
    return NextResponse.json(
      { error: "Failed to save food." },
      { status: 500 }
    );
  }
}
