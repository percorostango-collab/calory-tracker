import { NextRequest, NextResponse } from "next/server";
import { getDailyLog, addLogEntry, clearDailyLog } from "@/lib/server-actions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });

  const data = await getDailyLog(date);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { foodId, servings, date } = body;
  if (!foodId || !servings || !date) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await addLogEntry(foodId, servings, date);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });

  await clearDailyLog(date);
  return NextResponse.json({ success: true });
}
