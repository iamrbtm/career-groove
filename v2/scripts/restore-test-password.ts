import { readFileSync } from "node:fs";
import { Pool } from "pg";

const seed = JSON.parse(readFileSync(new URL("../seed/seed.json", import.meta.url), "utf8"));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

async function main() {
  const user = seed.users.find((u: any) => u.email === "rbtm2006@me.com");
  if (!user) throw new Error("admin user not found");
  await pool.query(
    `UPDATE account SET password = $1 WHERE user_id = $2 AND provider_id = 'credential'`,
    [user.passwordHash, user.id],
  );
  console.log("restored password for", user.email);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());