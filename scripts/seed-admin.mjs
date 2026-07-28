import pg from "pg";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const ask = (q) => new Promise(r => rl.question(q, r));

async function main() {
  const email = await ask("Enter the email of the user to grant admin access: ");
  if (!email) { console.error("Email is required."); process.exit(1); }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query("SELECT id FROM users WHERE email = $1", [email]);
    if (!result.rowCount) {
      console.error(`No user found with email "${email}". They must sign up first.`);
      process.exit(1);
    }
    const userId = result.rows[0].id;
    await client.query("INSERT INTO admins (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [userId]);
    console.log(`Admin access granted to ${email} (${userId}).`);
  } finally {
    await client.end();
    rl.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
