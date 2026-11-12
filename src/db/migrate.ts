import { Client } from "@libsql/client";

/**
 * Performs additive migrations to extend the database schema.
 * Uses PRAGMA table_info to ensure idempotency.
 */
export async function runMigrations(client: Client) {
  console.log("Starting additive migrations...");

  // 1. Extend 'foods' table
  const foodsColumns = await getTableColumns(client, "foods");

  const foodsExtensions = [
    { name: "sugar", type: "REAL" },
    { name: "fiber", type: "REAL" },
    { name: "category", type: "TEXT" },
    { name: "nova_group", type: "INTEGER" },
    { name: "is_healthy_flag", type: "INTEGER" },
    { name: "source", type: "TEXT" },
    { name: "saturated_fat", type: "REAL" },
    { name: "monounsaturated_fat", type: "REAL" },
    { name: "polyunsaturated_fat", type: "REAL" },
    { name: "omega_3", type: "REAL" },
    { name: "omega_6", type: "REAL" },
    { name: "trans_fat", type: "REAL" },
    { name: "cholesterol", type: "REAL" },
    { name: "sodium", type: "REAL" },
    { name: "animal_protein", type: "REAL" },
    { name: "vegetal_protein", type: "REAL" },
    { name: "alcohol", type: "REAL" },
  ];

  for (const col of foodsExtensions) {
    if (!foodsColumns.includes(col.name)) {
      console.log(`Adding column ${col.name} to foods...`);
      await client.execute(`ALTER TABLE foods ADD COLUMN ${col.name} ${col.type}`);
    }
  }

  // 2. Extend 'food_log' table
  const logColumns = await getTableColumns(client, "food_log");
  if (!logColumns.includes("cooking_method")) {
    console.log("Adding column cooking_method to food_log...");
    await client.execute(`ALTER TABLE food_log ADD COLUMN cooking_method TEXT`);
  }

  // 3. Create 'user_settings' table
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
