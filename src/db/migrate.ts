import { Client } from "@libsql/client";

/**
 * Performs additive migrations to extend the database schema.
 * Uses PRAGMA table_info to ensure idempotency.
 *
 * Note: the `foods` and `food_log` sections were removed — those legacy tables
 * are replaced by food_profiles / user_food_entries / food_cache (created in
 * initDb() via ensureNewTables and dropped by the one-time migration script
 * scripts/migrate-restart-db.ts). Only `user_settings` remains here.
 */
export async function runMigrations(client: Client) {
  console.log("Starting additive migrations...");

  // Create 'user_settings' table
  const settingsTables = await getTableColumns(client, "user_settings");
  if (settingsTables.length === 0) {
    console.log("Creating table user_settings...");
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weight REAL,
        gender TEXT,
        age INTEGER
      )
    `);
  }

  console.log("Migrations completed successfully.");
}

/**
 * Helper to fetch existing column names for a table.
 */
async function getTableColumns(client: Client, tableName: string): Promise<string[]> {
  const result = await client.execute(`PRAGMA table_info(${tableName})`);
  return result.rows.map((row: any) => row.name);
}
