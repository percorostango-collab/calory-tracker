import { createClient, Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
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

/**
 * Single source of truth for the DDL of the three "profiles" tables.
 *
 * Idempotent (IF NOT EXISTS). Reused by:
 *   - initDb()            at runtime (create-only)
 *   - scripts/migrate-restart-db.ts (one-time migration)
 *
 * NO DROP, NO ALTER, NO SEED lives here: this only creates the new tables and
 * their indexes when they are missing. The legacy `foods` / `food_log` tables
 * are intentionally left untouched at runtime — removing them is the job of the
 * explicit, registered, one-time migration script (see that file).
 */
export async function ensureNewTables(c: Client) {
  await c.execute(`
    CREATE TABLE IF NOT EXISTS food_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_name TEXT NOT NULL,
      brand TEXT,
      preparation TEXT,
      base_grams REAL,
      source TEXT NOT NULL DEFAULT 'ai',
      provider TEXT NOT NULL DEFAULT 'gemini',
      confidence REAL,
      nova_alignment INTEGER,
      calories INTEGER,
      protein REAL,
      carbs REAL,
      fat REAL,
      sugar REAL,
      fiber REAL,
      category TEXT,
      nova_group INTEGER,
      saturated_fat REAL,
      monounsaturated_fat REAL,
      polyunsaturated_fat REAL,
      omega_3 REAL,
      omega_6 REAL,
      trans_fat REAL,
      cholesterol REAL,
      sodium REAL,
      animal_protein REAL,
      vegetal_protein REAL,
      alcohol REAL,
      carne_lavorata INTEGER,
      carne_rossa INTEGER,
      pesce_alto_mercurio INTEGER,
      additivi INTEGER,
      alcol INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS user_food_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'local',
      food_profile_id INTEGER NOT NULL REFERENCES food_profiles(id),
      query_text TEXT NOT NULL,
      name TEXT,
      requested_grams REAL,
      calculated_calories INTEGER,
      calculated_protein REAL,
      calculated_carbs REAL,
      calculated_fat REAL,
      calculated_sugar REAL,
      calculated_fiber REAL,
      calculated_category TEXT,
      calculated_nova_group INTEGER,
      calculated_saturated_fat REAL,
      calculated_monounsaturated_fat REAL,
      calculated_polyunsaturated_fat REAL,
      calculated_omega_3 REAL,
      calculated_omega_6 REAL,
      calculated_trans_fat REAL,
      calculated_cholesterol REAL,
      calculated_sodium REAL,
      calculated_animal_protein REAL,
      calculated_vegetal_protein REAL,
      calculated_alcohol REAL,
      calculated_carne_lavorata INTEGER,
      calculated_carne_rossa INTEGER,
      calculated_pesce_alto_mercurio INTEGER,
      calculated_additivi INTEGER,
      calculated_alcol INTEGER,
      calculated_base_grams REAL,
      cooking_method TEXT,
      logged_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS food_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      normalized_query TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'gemini',
      name TEXT,
      canonical_name TEXT,
      brand TEXT,
      preparation TEXT,
      base_grams REAL,
      estimated_grams REAL,
      confidence REAL,
      calories INTEGER,
      protein REAL,
      carbs REAL,
      fat REAL,
      sugar REAL,
      fiber REAL,
      category TEXT,
      nova_group INTEGER,
      saturated_fat REAL,
      monounsaturated_fat REAL,
      polyunsaturated_fat REAL,
      omega_3 REAL,
      omega_6 REAL,
      trans_fat REAL,
      cholesterol REAL,
      sodium REAL,
      animal_protein REAL,
      vegetal_protein REAL,
      alcohol REAL,
      carne_lavorata INTEGER,
      carne_rossa INTEGER,
      pesce_alto_mercurio INTEGER,
      additivi INTEGER,
      alcol INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Identity: same name + brand + preparation -> one profile. "pizza" !=
  // "pizza margherita" because canonical_name differs. COALESCE groups null
  // brand/preparation together as ''.
  await c.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_food_profiles_identity
      ON food_profiles (canonical_name, COALESCE(brand, ''), COALESCE(preparation, ''));
  `);

  // One row per (query, component). "pizza" vs "pizza margherita" are distinct
  // normalized_query keys; a multi-component query yields several rows sharing
  // the same normalized_query (distinguished by name).
  await c.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_food_cache_query_name
      ON food_cache (normalized_query, name);
  `);
}

export async function initDb() {
  const c = getClient();

  // user_settings is unchanged from the legacy model (weight / gender / age).
  await c.execute(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight REAL,
      gender TEXT,
      age INTEGER
    )
  `);

  // Create the 3 new tables (no drop, no seed, no legacy tables touched).
  await ensureNewTables(c);

  // Additive migrations (now only user_settings; idempotent).
  await runMigrations(c);
}
