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
  await client.query(await readFile(resolve("db/schema.sql"), "utf8"));
  const files = (await readdir(resolve("db/migrations"))).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) await client.query(await readFile(resolve("db/migrations", file), "utf8"));
  console.log(`Database schema ready (${files.length} migrations).`);
} finally {
  await client.end();
}
