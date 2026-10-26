import { createHash } from "node:crypto";
import { z } from "zod";
import { db, withTransaction } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const categories = [
  "interview_reminder",
  "application_follow_up",
  "document_status",
  "command_session_action",
  "subscription_status",
] as const;

const registerSchema = z.object({
  deviceToken: z.string().regex(/^[0-9a-fA-F]{64,256}$/),
  environment: z.enum(["sandbox", "production"]),
  enabledCategories: z.array(z.enum(categories)).max(categories.length),
  appVersion: z.string().max(40).optional(),
  locale: z.string().max(40).optional(),
});

const unregisterSchema = z.object({ deviceToken: z.string().regex(/^[0-9a-fA-F]{64,256}$/) });
const tokenHash = (value: string) => createHash("sha256").update(value.toLowerCase()).digest("hex");

export async function PUT(request: Request) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const conflict = await withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO push_devices
        (user_id,token_hash,device_token,environment,enabled_categories,app_version,locale)
       VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)
       ON CONFLICT(token_hash) DO NOTHING`,
      [userId, tokenHash(input.deviceToken), input.deviceToken.toLowerCase(), input.environment,
        JSON.stringify(input.enabledCategories), input.appVersion ?? null, input.locale ?? null],
    );
    if (inserted.rowCount) return null;
    const existing = await client.query(
      "SELECT user_id FROM push_devices WHERE token_hash=$1",
      [tokenHash(input.deviceToken)],
    );
    if (!existing.rows[0]) return null;
    if (existing.rows[0].user_id !== userId) {
      return Response.json({ error: "Device token is already bound." }, { status: 409 });
    }
    await client.query(
      `UPDATE push_devices SET
        device_token=$3,environment=$4,enabled_categories=$5::jsonb,app_version=$6,
        locale=$7,last_seen_at=now(),updated_at=now()
       WHERE token_hash=$2`,
      [userId, tokenHash(input.deviceToken), input.deviceToken.toLowerCase(), input.environment,
        JSON.stringify(input.enabledCategories), input.appVersion ?? null, input.locale ?? null],
    );
    return null;
  });
  if (conflict) return conflict;
  return new Response(null, { status: 204 });
}

export async function DELETE(request: Request) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const parsed = unregisterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid device token" }, { status: 400 });
  await db.query(
    "DELETE FROM push_devices WHERE user_id=$1 AND token_hash=$2",
    [userId, tokenHash(parsed.data.deviceToken)],
  );
  return new Response(null, { status: 204 });
}
