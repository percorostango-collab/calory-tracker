import { NextRequest, NextResponse } from "next/server";
import { removeLogEntry } from "@shared/lib/server-actions";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await removeLogEntry(Number(id));
  return NextResponse.json({ success: true });
}
