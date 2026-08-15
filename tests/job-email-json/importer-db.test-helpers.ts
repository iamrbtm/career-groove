import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import { parseJobEmailPayload } from "@/lib/job-email-json/schema";
import { validEmailBody } from "./fixtures";

const databaseUrl = process.env.DATABASE_URL
  ?? "postgresql://career_groove:career_groove@127.0.0.1:5432/career_groove";

export const validPayload = parseJobEmailPayload(extractJobJson(validEmailBody));

export async function makeDbClient() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(await readFile(resolve(process.cwd(), "db/schema.sql"), "utf8"));
  await client.query(await readFile(resolve(process.cwd(), "db/migrations/019_job_email_json_import.sql"), "utf8"));
  return client;
}

export async function seedUser(client: Client) {
  const email = `job-email-import-${crypto.randomUUID()}@example.test`;
  const result = await client.query<{ id: string }>(
    "INSERT INTO users(email) VALUES($1) RETURNING id",
    [email],
  );
  return result.rows[0].id;
}
