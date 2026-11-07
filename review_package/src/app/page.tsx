import { initDb, db } from "@/db";
import { getDailyLog, getFoods } from "@/lib/server-actions";
import CalorieTracker from "@/components/CalorieTracker";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Auto-init: create tables and seed foods on first run (idempotent)
  await initDb();

  const today = new Date().toISOString().split("T")[0];
  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const initialData = await getDailyLog(today);
  const initialFoods = await getFoods("");

  return (
    <main className="min-h-screen bg-background">
      <CalorieTracker
        initialData={initialData}
        initialFoods={initialFoods}
        today={today}
        formattedDate={formattedDate}
      />
    </main>
  );
}
