import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { getDailyLog, addLogEntry, clearDailyLog } from "@/lib/server-actions";

async function getUserId(request: NextRequest): Promise<string | null> {
  const { userId } = await getAuth(request);
  return userId;
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });

  const data = await getDailyLog(userId, date);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { foodId, servings, date } = body;
  if (!foodId || !servings || !date) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await addLogEntry(userId, foodId, servings, date);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });

  await clearDailyLog(userId, date);
  return NextResponse.json({ success: true });
}
