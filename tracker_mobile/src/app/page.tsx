import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import MobileTracker from "@/components/MobileTracker";
import { getDailyLog, getFoods } from "@/lib/server-actions";
import { ensureSchema } from "@/db";

// La pagina dipende dalla sessione Clerk (dati per-utente): non puo' essere prerenderizzata.
export const instant = false;

async function getInitialData(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const formattedDate = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  const [data, foods] = await Promise.all([
    getDailyLog(userId, today),
    getFoods("")
  ]);

  return { data, foods, today, formattedDate };
}

export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await ensureSchema(); // migrazione idempotente (colonna userId su food_log)
  const { data, foods, today, formattedDate } = await getInitialData(userId);

  return (
    <main className="min-h-screen bg-slate-50">
      <MobileTracker
        initialData={data}
        initialFoods={foods}
        today={today}
        formattedDate={formattedDate}
      />
    </main>
  );
}
