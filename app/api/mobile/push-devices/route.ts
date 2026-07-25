import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
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
  await db.query(
    `INSERT INTO push_devices
      (user_id,token_hash,device_token,environment,enabled_categories,app_version,locale)
     VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)
     ON CONFLICT(token_hash) DO UPDATE SET
       user_id=EXCLUDED.user_id,device_token=EXCLUDED.device_token,environment=EXCLUDED.environment,
       enabled_categories=EXCLUDED.enabled_categories,app_version=EXCLUDED.app_version,
       locale=EXCLUDED.locale,last_seen_at=now(),updated_at=now()`,
    [userId, tokenHash(input.deviceToken), input.deviceToken.toLowerCase(), input.environment,
      JSON.stringify(input.enabledCategories), input.appVersion ?? null, input.locale ?? null],
  );
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
