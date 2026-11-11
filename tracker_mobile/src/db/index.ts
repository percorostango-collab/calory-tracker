import { createClient, Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { seedFoods } from "./seed";

let client: Client | undefined;

function getClient() {
  if (!client) {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      client = createClient({
        url: dbUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    } else {
      // Local development fallback
      console.warn("DATABASE_URL not set. Using local file sqlite.db");
      client = createClient({ url: "file:sqlite.db" });
    }
  }
  return client;
}

export const db = drizzle(getClient(), { schema });

export async function initDb() {
  const c = getClient();
  await c.execute(`
    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      calories INTEGER NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      servingSize TEXT NOT NULL
    );
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS food_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      foodId INTEGER NOT NULL,
      servings REAL NOT NULL DEFAULT 1,
      loggedAt TEXT NOT NULL,
      FOREIGN KEY (foodId) REFERENCES foods(id)
    );
  `);

  // Seed only if no foods exist, to avoid duplicate errors on every init
  const existing = await c.execute("SELECT count(*) as count FROM foods");
  const count = (existing.rows[0] as any).count;

  if (count === 0) {
    console.log("Seeding initial foods...");
    await seedFoods(db);
  }
}

// Migrazione self-healing: i database creati prima dell'introduzione di Clerk
// hanno food_log SENZA la colonna userId. La aggiungo se manca (idempotente,
// non modifica i dati esistenti: le righe vecchie ricevono userId = '').
export async function ensureSchema() {
  await initDb();
  const c = getClient();
  const info = await c.execute("PRAGMA table_info(food_log)");
  const nameIdx = info.columns.indexOf("name");
  const hasUserId = info.rows.some(
    (row) => String(row[nameIdx]) === "userId"
  );
  if (!hasUserId) {
    try {
      await c.execute(
        "ALTER TABLE food_log ADD COLUMN userId TEXT NOT NULL DEFAULT ''"
      );
      console.log("Migrated food_log: added userId column");
    } catch (error) {
      // "duplicate column name": un'istanza concorrente ha migrato prima di noi.
      console.warn(
        "food_log migration skipped:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
