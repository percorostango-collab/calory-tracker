import { NextResponse } from "next/server";
import { getHealthEntries } from "@/lib/health-adapter";
import { aggregateDay } from "@/lib/health/aggregate";
import { generateRecommendations } from "@/lib/health/recommendations";
import { getUserWeight } from "@/lib/settings-actions";

export const dynamic = "force-dynamic";

/**
 * GET /api/health/metrics?date=YYYY-MM-DD
 * Returns aggregated health metrics + recommendations for a given day.
 * Pure read: components receive data as props, no DB access on the client.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Valid date parameter (YYYY-MM-DD) is required." },
      { status: 400 }
    );
  }

  const entries = await getHealthEntries(date);
  const weightKg = await getUserWeight();
  const metrics = aggregateDay(entries, weightKg);
  const recommendations = generateRecommendations(metrics);

  return NextResponse.json({ metrics, recommendations });
}
