"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema";

export async function getUserWeight(): Promise<number | null> {
  const result = await db.select().from(userSettings).limit(1);
  return result[0]?.weight ?? null;
}

export async function saveWeight(weight: number): Promise<void> {
  const current = await db.select().from(userSettings).limit(1);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
    throw new Error("Peso non valido.");
  }
  if (current.length === 0) {
    await db.insert(userSettings).values({ weight });
  } else {
    await db
      .update(userSettings)
      .set({ weight })
      .where(eq(userSettings.id, current[0].id));
  }
}
