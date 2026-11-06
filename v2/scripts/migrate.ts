import { readFileSync } from "node:fs";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 1 });

async function main() {
  const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await pool.query(sql);
      console.log("migrate: schema is up to date");
      return;
    } catch (error) {
      if (attempt === 30) throw error;
      console.log(`migrate: waiting for database (attempt ${attempt})`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
