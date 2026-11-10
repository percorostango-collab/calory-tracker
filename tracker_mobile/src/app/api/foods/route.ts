import { NextRequest, NextResponse } from "next/server";
import { getFoods } from "@shared/lib/server-actions";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const data = await getFoods(q);
  return NextResponse.json(data);
}
