import { Pool } from "pg";
import { db } from "#lib/server/db";
import {
  applicationContacts,
  applicationEvents,
  applications,
  contacts,
  documents,
  emailLog,
  followUps,
  interviews,
  researchNotes,
} from "#lib/server/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

async function main() {
  await db.transaction(async (tx) => {
    await tx.delete(applicationContacts);
    await tx.delete(applicationEvents);
    await tx.delete(emailLog);
    await tx.delete(followUps);
    await tx.delete(interviews);
    await tx.delete(documents);
    await tx.delete(researchNotes);
    await tx.delete(applications);
    await tx.delete(contacts);
  });
  console.log("cleanup: test data removed");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());