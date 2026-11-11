import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { upsertFood } from "@/lib/server-actions";
import type { NewFood } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { userId } = await getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  } catch (error: unknown) {
    console.error("API AI Food Upsert Error:", error);
    return NextResponse.json(
      { error: "Failed to save food." },
      { status: 500 }
    );
  }
}
