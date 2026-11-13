import { createClient, Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { seedFoods } from "./seed";
import { runMigrations } from "./migrate";

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
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight REAL,
      gender TEXT,
      age INTEGER
    )
  `);

  // Run migrations to add new columns
  await runMigrations(c);

  // Seed only if no foods exist, to avoid duplicate errors on every init
  const existing = await c.execute("SELECT count(*) as count FROM foods");
  const count = (existing.rows[0] as any).count;

  if (count === 0) {
    console.log("Seeding initial foods...");
    await seedFoods(db);
  }
}
