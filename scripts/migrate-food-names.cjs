// One-time migration: translate old English seed food names to Italian.
// If the Italian name already exists, merges the old row into it (keeps log refs).
// Run: node scripts/migrate-food-names.cjs
const { createClient } = require("@libsql/client");
const path = require("path");

const client = createClient({ url: `file:${path.join(process.cwd(), "sqlite.db")}` });

const MAPPING = {
  "Chicken Breast": "Petto di Pollo",
  "White Rice": "Riso Bianco",
  "Brown Rice": "Riso Integrale",
  "Basmati Rice": "Riso Basmati",
  "Jasmine Rice": "Riso Jasmine",
  "Egg": "Uovo",
  "Oats": "Avena",
  "Salmon": "Salmone",
  "Greek Yogurt": "Yogurt Greco",
  "Almonds": "Mandorle",
  "Sweet Potato": "Patata Dolce",
  "Peanut Butter": "Burro d'Arachidi",
  "Beef": "Manzo",
  "Apple": "Mela",
  "Spinach": "Spinaci",
  "Lentils": "Lenticchie",
  "Cheddar Cheese": "Formaggio Cheddar",
  "Olive Oil": "Olio d'Oliva",
  "Black Beans": "Fagioli Neri",
  "Banana": "Banana",
  "Avocado": "Avocado",
  "Tofu": "Tofu",
  "Quinoa": "Quinoa",
  "Broccoli": "Broccoli",
};

(async () => {
  const { rows } = await client.execute("SELECT id, name FROM foods");
  let renamed = 0;
  let merged = 0;

  for (const row of rows) {
    const newName = MAPPING[row.name];
    if (!newName) continue;
    if (newName === row.name) continue; // already Italian

    const existing = await client.execute({
      sql: "SELECT id FROM foods WHERE name = ?",
      args: [newName],
    });
    const targetId = existing.rows[0]?.id;

    if (targetId && targetId !== row.id) {
      // Merge: point log entries to the existing Italian row, then delete the old one
      await client.execute({
        sql: "UPDATE food_log SET foodId = ? WHERE foodId = ?",
        args: [targetId, row.id],
      });
      await client.execute({
        sql: "DELETE FROM foods WHERE id = ?",
        args: [row.id],
      });
      console.log(`Merged: "${row.name}" (id ${row.id}) into existing "${newName}" (id ${targetId})`);
      merged++;
    } else if (!targetId) {
      await client.execute({
        sql: "UPDATE foods SET name = ? WHERE id = ?",
        args: [newName, row.id],
      });
      console.log(`Renamed: "${row.name}" -> "${newName}"`);
      renamed++;
    }
  }

  console.log(`Migration completed. ${renamed} renamed, ${merged} merged.`);
  process.exit(0);
})().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
