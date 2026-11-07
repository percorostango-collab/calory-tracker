import { NextRequest, NextResponse } from "next/server";
import { getFoods } from "@/lib/server-actions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const data = await getFoods(q);
  return NextResponse.json(data);
}
