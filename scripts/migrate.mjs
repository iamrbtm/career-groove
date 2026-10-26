import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is unset; skipping database migrations.");
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  // Databases created before tracking existed get a one-time baseline pass:
  // every existing migration file is re-executed (they are idempotent) and
  // recorded, after which future migrations run exactly once.
  const legacy =
    (await client.query("SELECT to_regclass('public.users') IS NOT NULL AS present")).rows[0].present;
  await client.query(await readFile(resolve("db/schema.sql"), "utf8"));
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );
  const recorded = new Set(
    (await client.query("SELECT name FROM schema_migrations")).rows.map((row) => row.name),
  );

  const files = (await readdir(resolve("db/migrations"))).filter((name) => name.endsWith(".sql")).sort();
  const pending = files.filter((name) => !recorded.has(name));

  for (const file of pending) {
    const sql = await readFile(resolve("db/migrations", file), "utf8");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
    } catch (error) {
      console.error(`Migration failed: ${file}`, error.message);
      throw error;
    }
  }

  console.log(legacy ? "Legacy database baseline established." : "Database schema ready.");
  console.log(`Applied ${pending.length} of ${files.length} migrations (tracking table active).`);
} finally {
  await client.end();
}
