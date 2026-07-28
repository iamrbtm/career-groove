import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized, isAdmin, getSetting } from "@/lib/api-auth";

export async function GET() {
  const user = await requireUser();
  if (!user || !(await isAdmin(user))) return unauthorized();
  const result = await db.query("SELECT key, value, updated_at FROM settings ORDER BY key");
  const settings: Record<string, unknown> = {};
  for (const row of result.rows) settings[row.key] = row.value;
  return Response.json({ settings });
}

const patchSchema = z.record(z.string(), z.unknown());

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user || !(await isAdmin(user))) return unauthorized();
  const body = patchSchema.safeParse(await request.json());
  if (!body.success) return Response.json({ error: "Invalid settings payload" }, { status: 400 });
  for (const [key, value] of Object.entries(body.data)) {
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
      [key, JSON.stringify(value)],
    );
  }
  return Response.json({ ok: true });
}
