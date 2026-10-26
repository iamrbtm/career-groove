import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized, isAdmin, getSetting } from "@/lib/api-auth";
import { encryptStoredSecret, redactPremiumAiConfig } from "@/lib/premium-ai";

const REDACTED_KEYS = new Set(["premium_ai_config"]);

export async function GET() {
  const user = await requireUser();
  if (!user || !(await isAdmin(user))) return unauthorized();
  const result = await db.query("SELECT key, value, updated_at FROM settings ORDER BY key");
  const settings: Record<string, unknown> = {};
  for (const row of result.rows) {
    const value = row.value as Record<string, unknown> | null;
    if (REDACTED_KEYS.has(row.key) && value && !Array.isArray(value)) {
      settings[row.key] = redactPremiumAiConfig(value);
    } else {
      settings[row.key] = row.value;
    }
  }
  return Response.json({ settings });
}

const patchSchema = z.record(z.string(), z.unknown());

async function preparePremiumAiConfig(value: Record<string, unknown>) {
  const incoming = { ...value };
  const apiKey = incoming.api_key;
  if (typeof apiKey === "string" && apiKey.trim() === "") {
    delete incoming.api_key;
    const existing = await db.query("SELECT value FROM settings WHERE key = $1", ["premium_ai_config"]);
    const stored = (existing.rows[0]?.value ?? {}) as Record<string, unknown>;
    return { ...stored, ...incoming };
  }
  if (typeof apiKey === "string" && apiKey.trim() !== "") {
    incoming.api_key = encryptStoredSecret(apiKey);
  }
  return incoming;
}

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user || !(await isAdmin(user))) return unauthorized();
  const body = patchSchema.safeParse(await request.json());
  if (!body.success) return Response.json({ error: "Invalid settings payload" }, { status: 400 });
  for (const [key, value] of Object.entries(body.data)) {
    let payload = value;
    if (key === "premium_ai_config" && value && typeof value === "object" && !Array.isArray(value)) {
      payload = await preparePremiumAiConfig(value as Record<string, unknown>);
    }
    await db.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
      [key, JSON.stringify(payload)],
    );
  }
  return Response.json({ ok: true });
}
