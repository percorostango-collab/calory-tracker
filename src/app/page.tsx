import { initDb } from "@/db";
import { getDailyLog } from "@/lib/server-actions";
import CalorieTracker from "@/components/CalorieTracker";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Auto-init: create the new tables if missing (idempotent, no seed, no drop).
  await initDb();

  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const formattedDate = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const initialData = await getDailyLog(today);

  return (
    <main className="min-h-screen bg-background">
      <CalorieTracker
        initialData={initialData}
        today={today}
        formattedDate={formattedDate}
      />
    </main>
  );
}
