import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { removeLogEntry } from "@/lib/server-actions";

export async function DELETE(request: NextRequest) {
  const { userId } = await getAuth(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await removeLogEntry(userId, Number(id));
  return NextResponse.json({ success: true });
}
