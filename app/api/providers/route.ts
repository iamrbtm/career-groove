import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";
import { discoverModels, providerSchema } from "@/lib/provider-models";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect"), provider: providerSchema, apiKey: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("refresh"), provider: providerSchema }),
  z.object({ action: z.literal("select"), provider: providerSchema, model: z.string().min(1).max(200) }),
]);

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const result = await db.query(`SELECT provider, encrypted_api_key AS "encryptedApiKey", key_hint AS "keyHint", selected_model AS "selectedModel", available_models AS models, active, last_checked_at AS "lastCheckedAt", last_error AS "lastError" FROM provider_connections WHERE user_id=$1 ORDER BY provider`, [user]);
  const preferences = await db.query(`SELECT preferences->>'aiProvider' AS "defaultProvider" FROM users WHERE id=$1`, [user]);
  const connections = result.rows.map((connection) => {
    const { encryptedApiKey, ...safeConnection } = connection;
    if (!encryptedApiKey) return safeConnection;
    try {
      decryptSecret(encryptedApiKey);
      return safeConnection;
    } catch {
      return { ...safeConnection, active: false, lastError: "The saved API key can no longer be decrypted. Enter the key again to reconnect." };
    }
  });
  return Response.json({ connections, defaultProvider: preferences.rows[0]?.defaultProvider ?? null });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid provider request" }, { status: 400 });
  const input = parsed.data;
  if (input.action === "select") {
    const result = await db.query(`UPDATE provider_connections SET selected_model=$3,updated_at=now() WHERE user_id=$1 AND provider=$2 AND active=true AND available_models @> $4::jsonb RETURNING provider,selected_model AS "selectedModel"`, [user,input.provider,input.model,JSON.stringify([{id:input.model}])]);
    if (!result.rowCount) return Response.json({ error: "Select a model returned by this active provider." }, { status: 400 });
    await db.query(`UPDATE users SET preferences=preferences || $1::jsonb,updated_at=now() WHERE id=$2`, [JSON.stringify({aiProvider:input.provider}),user]);
    return Response.json({ connection: result.rows[0] });
  }
  let apiKey: string | undefined;
  if (input.action === "connect") {
    apiKey = input.apiKey;
    if (input.provider !== "ollama" && !apiKey) return Response.json({ error: "An API key is required." }, { status: 400 });
  } else {
    const existing = await db.query(`SELECT encrypted_api_key FROM provider_connections WHERE user_id=$1 AND provider=$2`, [user,input.provider]);
    if (!existing.rowCount) return Response.json({ error: "Connect this provider first." }, { status: 404 });
    try {
      apiKey = existing.rows[0].encrypted_api_key ? decryptSecret(existing.rows[0].encrypted_api_key) : undefined;
    } catch {
      return Response.json({ error: "The saved API key can no longer be decrypted. Enter the key again to reconnect." }, { status: 409 });
    }
  }
  try {
    const discovery = await discoverModels(input.provider, apiKey);
    const { models } = discovery;
    if (!models.length) throw new Error("The provider returned no compatible text-generation models.");
    const encrypted = apiKey ? encryptSecret(apiKey) : null;
    const hint = apiKey ? `••••${apiKey.slice(-4)}` : "Local connection";
    const result = await db.query(`INSERT INTO provider_connections(user_id,provider,encrypted_api_key,key_hint,base_url,selected_model,available_models,active,last_checked_at,last_error) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,true,now(),null) ON CONFLICT(user_id,provider) DO UPDATE SET encrypted_api_key=COALESCE(EXCLUDED.encrypted_api_key,provider_connections.encrypted_api_key),key_hint=EXCLUDED.key_hint,base_url=EXCLUDED.base_url,selected_model=CASE WHEN EXCLUDED.available_models @> jsonb_build_array(jsonb_build_object('id',provider_connections.selected_model)) THEN provider_connections.selected_model ELSE EXCLUDED.selected_model END,available_models=EXCLUDED.available_models,active=true,last_checked_at=now(),last_error=null,updated_at=now() RETURNING provider,key_hint AS "keyHint",selected_model AS "selectedModel",available_models AS models,active,last_checked_at AS "lastCheckedAt"`, [user,input.provider,encrypted,hint,discovery.baseUrl??null,models[0].id,JSON.stringify(models)]);
    return Response.json({ connection: result.rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider connection failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const provider = providerSchema.safeParse(new URL(request.url).searchParams.get("provider"));
  if (!provider.success) return Response.json({ error: "Invalid provider" }, { status: 400 });
  await db.query(`DELETE FROM provider_connections WHERE user_id=$1 AND provider=$2`, [user,provider.data]);
  return new Response(null, { status: 204 });
}
