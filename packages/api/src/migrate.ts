import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import type { Database } from "./db.js";

const migrationLock = 706_839_114;

export async function migrateDatabase(
  database: Database,
  root = process.cwd(),
): Promise<number> {
  const schema = await readFile(resolve(root, "db/schema.sql"), "utf8");
  const migrationDirectory = resolve(root, "db/migrations");
  const files = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const migrations = await Promise.all(
    files.map((file) => readFile(resolve(migrationDirectory, file), "utf8")),
  );
  await database.query(
    [
      "BEGIN;",
      `SELECT pg_advisory_xact_lock(${migrationLock});`,
      schema,
      ...migrations,
      "COMMIT;",
    ].join("\n"),
  );
  return files.length;
}
