import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "path";
import * as schema from "./schema";
import { seedFoods } from "./seed";

const dbFile = path.join(process.cwd(), "sqlite.db");
const client = createClient({
  url: `file:${dbFile}`,
});

export const db = drizzle(client, { schema });

export async function initDb() {
  await client.execute(`
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

  await client.execute(`
    CREATE TABLE IF NOT EXISTS food_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      foodId INTEGER NOT NULL,
      servings REAL NOT NULL DEFAULT 1,
      loggedAt TEXT NOT NULL,
      FOREIGN KEY (foodId) REFERENCES foods(id)
    );
  `);

  await seedFoods(db);
}
