import { Hono } from "hono";
import { z } from "zod";

import { providerSchema, type ProviderName } from "@career-groove/shared";

import type { ApiConfig } from "../../config.js";
import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import type { SessionService } from "../auth/session-service.js";
import { SecretBox } from "./secret-box.js";

const requestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("connect"),
      apiKey: z.string().trim().min(1).max(1_000).optional(),
      provider: providerSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("refresh"),
      provider: providerSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("select"),
      model: z.string().trim().min(1).max(200),
      provider: providerSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("setDefault"),
      provider: providerSchema,
    })
    .strict(),
]);

interface Dependencies {
  config: ApiConfig;
  database: Database;
  fetch?: typeof fetch;
  sessions: SessionService;
}

interface ProviderRow {
  active: boolean;
  availableModels: unknown;
  baseUrl?: string | null;
  id: string;
  keyHint: string | null;
  lastCheckedAt?: string | null;
  lastError?: string | null;
  provider: ProviderName;
  selectedModel?: string | null;
}

function publicProvider(row: ProviderRow) {
  return {
    active: row.active,
    availableModels: row.availableModels,
    baseUrl: row.baseUrl ?? null,
    id: row.id,
    keyHint: row.keyHint,
    lastCheckedAt: row.lastCheckedAt ?? null,
    lastError: row.lastError ?? null,
    provider: row.provider,
    selectedModel: row.selectedModel ?? null,
  };
}

function modelNames(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if ("data" in value && Array.isArray(value.data)) {
    return value.data
      .map((model) =>
        model && typeof model === "object" && "id" in model
          ? String(model.id)
          : "",
      )
      .filter(Boolean);
  }
  if ("models" in value && Array.isArray(value.models)) {
    return value.models
      .map((model) => {
        if (!model || typeof model !== "object") return "";
        if ("name" in model) return String(model.name);
        if ("id" in model) return String(model.id);
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

async function discoverModels(
  provider: ProviderName,
  apiKey: string | undefined,
  transport: typeof fetch,
): Promise<string[]> {
  let url: string;
  let headers: Record<string, string>;
  if (provider === "openai") {
    if (!apiKey) throw new Error("An OpenAI API key is required");
    url = "https://api.openai.com/v1/models";
    headers = { Authorization: `Bearer ${apiKey}` };
  } else if (provider === "google") {
    if (!apiKey) throw new Error("A Google API key is required");
    url = "https://generativelanguage.googleapis.com/v1beta/models";
    headers = { "x-goog-api-key": apiKey };
  } else if (provider === "anthropic") {
    if (!apiKey) throw new Error("An Anthropic API key is required");
    url = "https://api.anthropic.com/v1/models";
    headers = {
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    };
  } else {
    url = `${(process.env.OLLAMA_BASE_URL ?? "http://ollama:11434").replace(/\/$/, "")}/api/tags`;
    headers = {};
  }
  const response = await transport(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Model discovery failed (${response.status})`);
  const models = modelNames(await response.json());
  if (!models.length) throw new Error("No models were returned");
  return [...new Set(models)].sort();
}

export function createProviderRoutes({
  config,
  database,
  fetch: transport = fetch,
  sessions,
}: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  const secretBox = new SecretBox(config.providerEncryptionKey);
  routes.use("*", createAuthMiddleware(sessions));

  routes.get("/", async (context) => {
    const result = await database.query<ProviderRow>(
      `SELECT id,provider,key_hint AS "keyHint",base_url AS "baseUrl",
        selected_model AS "selectedModel",available_models AS "availableModels",
        active,last_checked_at AS "lastCheckedAt",last_error AS "lastError"
       FROM provider_connections WHERE user_id=$1 ORDER BY provider`,
      [context.get("userId")],
    );
    return context.json({
      providers: result.rows.map(publicProvider),
    });
  });

  routes.post("/", async (context) => {
    const parsed = requestSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_provider_request",
        "Invalid provider request",
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    if (input.action === "setDefault") {
      await database.query(
        `UPDATE users SET
          preferences=preferences || jsonb_build_object('aiProvider',$1),
          updated_at=now()
         WHERE id=$2`,
        [input.provider, context.get("userId")],
      );
      return context.json({ provider: input.provider });
    }
    if (input.action === "select") {
      const result = await database.query<ProviderRow>(
        `UPDATE provider_connections SET selected_model=$3,updated_at=now()
         WHERE user_id=$1 AND provider=$2
           AND available_models ? $3
         RETURNING id,provider,key_hint AS "keyHint",base_url AS "baseUrl",
          selected_model AS "selectedModel",
          available_models AS "availableModels",active,
          last_checked_at AS "lastCheckedAt",last_error AS "lastError"`,
        [context.get("userId"), input.provider, input.model],
      );
      if (!result.rows[0]) {
        return jsonError(context, 400, "invalid_model", "Model is not available");
      }
      return context.json({ provider: publicProvider(result.rows[0]) });
    }

    let apiKey = input.action === "connect" ? input.apiKey : undefined;
    if (!apiKey && input.provider !== "ollama") {
      const existing = await database.query<{ encrypted_api_key: string | null }>(
        `SELECT encrypted_api_key FROM provider_connections
         WHERE user_id=$1 AND provider=$2`,
        [context.get("userId"), input.provider],
      );
      if (existing.rows[0]?.encrypted_api_key) {
        apiKey = secretBox.decrypt(existing.rows[0].encrypted_api_key);
      }
    }
    try {
      const models = await discoverModels(input.provider, apiKey, transport);
      const encryptedApiKey = apiKey ? secretBox.encrypt(apiKey) : null;
      const keyHint = apiKey ? `…${apiKey.slice(-4)}` : null;
      const result = await database.query<ProviderRow>(
        `INSERT INTO provider_connections
          (user_id,provider,encrypted_api_key,key_hint,base_url,
           available_models,selected_model,active,last_checked_at,last_error)
         VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,true,now(),null)
         ON CONFLICT(user_id,provider) DO UPDATE SET
          encrypted_api_key=COALESCE(EXCLUDED.encrypted_api_key,
            provider_connections.encrypted_api_key),
          key_hint=COALESCE(EXCLUDED.key_hint,provider_connections.key_hint),
          base_url=EXCLUDED.base_url,available_models=EXCLUDED.available_models,
          selected_model=CASE
            WHEN provider_connections.selected_model = ANY($8::text[])
              THEN provider_connections.selected_model
            ELSE EXCLUDED.selected_model
          END,
          active=true,last_checked_at=now(),last_error=null,updated_at=now()
         RETURNING id,provider,key_hint AS "keyHint",base_url AS "baseUrl",
          selected_model AS "selectedModel",
          available_models AS "availableModels",active,
          last_checked_at AS "lastCheckedAt",last_error AS "lastError"`,
        [
          context.get("userId"),
          input.provider,
          encryptedApiKey,
          keyHint,
          input.provider === "ollama"
            ? process.env.OLLAMA_BASE_URL ?? "http://ollama:11434"
            : null,
          JSON.stringify(models),
          models[0],
          models,
        ],
      );
      return context.json({ provider: publicProvider(result.rows[0]!) });
    } catch (error) {
      return jsonError(
        context,
        400,
        "provider_connection_failed",
        error instanceof Error ? error.message : "Provider connection failed",
      );
    }
  });

  routes.delete("/:provider", async (context) => {
    const provider = providerSchema.safeParse(context.req.param("provider"));
    if (!provider.success) {
      return jsonError(context, 400, "invalid_provider", "Invalid provider");
    }
    await database.query(
      "DELETE FROM provider_connections WHERE user_id=$1 AND provider=$2",
      [context.get("userId"), provider.data],
    );
    return context.body(null, 204);
  });
  return routes;
}
