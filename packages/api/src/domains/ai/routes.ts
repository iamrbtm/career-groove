import { Hono } from "hono";
import { z } from "zod";

import { providerSchema, type ProviderName } from "@career-groove/shared";

import type { ApiConfig } from "../../config.js";
import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import type { SessionService } from "../auth/session-service.js";
import { SecretBox } from "../providers/secret-box.js";

interface Dependencies {
  config: ApiConfig;
  database: Database;
  fetch?: typeof fetch;
  sessions: SessionService;
}

const purposes = [
  "job-interviewer",
  "job-interview-probe",
  "mock-interview",
  "resume",
  "cover-letter",
  "application-answers",
  "outreach-draft",
  "soundcheck-brief",
] as const;
const requestSchema = z
  .object({
    provider: providerSchema.optional(),
    purpose: z.enum(purposes).default("job-interviewer"),
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string().min(1).max(20_000),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
const prompts: Record<(typeof purposes)[number], string> = {
  "application-answers":
    "Answer application questions honestly using only supplied context. State what is missing instead of inventing.",
  "cover-letter":
    "Write a specific human cover letter grounded only in supplied experience and target-role context.",
  "job-interview-probe":
    'Ask at most one useful plain-language follow-up. Return only JSON: {"needsFollowUp":boolean,"question":"..."}.',
  "job-interviewer":
    "Create factual resume-ready achievement bullets and supported skills. Never invent facts or metrics.",
  "mock-interview":
    "Act as a challenging but supportive reverse mock interviewer. Give concise coaching after each answer.",
  "outreach-draft":
    "Draft concise editable outreach grounded only in the supplied application and contact context.",
  resume:
    "Create precise ATS-friendly resume content. Never invent facts or unsupported metrics.",
  "soundcheck-brief":
    "Create an interview prep brief with likely questions, stories, weak spots, and questions to ask.",
};

interface Connection {
  base_url: string | null;
  encrypted_api_key: string | null;
  provider: ProviderName;
  selected_model: string;
}

async function providerText(
  connection: Connection,
  apiKey: string | undefined,
  system: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  transport: typeof fetch,
  signal: AbortSignal,
): Promise<string> {
  let url: string;
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: unknown;
  if (connection.provider === "openai") {
    if (!apiKey) throw new Error("Missing OpenAI key");
    url = "https://api.openai.com/v1/chat/completions";
    headers.Authorization = `Bearer ${apiKey}`;
    body = {
      messages: [{ role: "system", content: system }, ...messages],
      model: connection.selected_model,
    };
  } else if (connection.provider === "anthropic") {
    if (!apiKey) throw new Error("Missing Anthropic key");
    url = "https://api.anthropic.com/v1/messages";
    headers["anthropic-version"] = "2023-06-01";
    headers["x-api-key"] = apiKey;
    body = {
      max_tokens: 4_096,
      messages: messages.filter((message) => message.role !== "system"),
      model: connection.selected_model,
      system,
    };
  } else if (connection.provider === "google") {
    if (!apiKey) throw new Error("Missing Google key");
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(connection.selected_model)}:generateContent`;
    headers["x-goog-api-key"] = apiKey;
    body = {
      contents: messages.map((message) => ({
        parts: [{ text: message.content }],
        role: message.role === "assistant" ? "model" : "user",
      })),
      systemInstruction: { parts: [{ text: system }] },
    };
  } else {
    const base = (process.env.OLLAMA_BASE_URL ?? "http://ollama:11434").replace(
      /\/$/,
      "",
    );
    url = `${base}/api/chat`;
    body = {
      messages: [{ role: "system", content: system }, ...messages],
      model: connection.selected_model,
      stream: false,
    };
  }
  const response = await transport(url, {
    body: JSON.stringify(body),
    headers,
    method: "POST",
    signal,
  });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  const payload = (await response.json()) as Record<string, any>;
  const text =
    connection.provider === "openai"
      ? payload.choices?.[0]?.message?.content
      : connection.provider === "anthropic"
        ? payload.content?.map((item: any) => item.text ?? "").join("")
        : connection.provider === "google"
          ? payload.candidates?.[0]?.content?.parts
              ?.map((item: any) => item.text ?? "")
              .join("")
          : payload.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Provider returned an empty response");
  }
  return text.trim();
}

export function createAiRoutes({
  config,
  database,
  fetch: transport = fetch,
  sessions,
}: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  const secrets = new SecretBox(config.providerEncryptionKey);
  routes.use("*", createAuthMiddleware(sessions));
  routes.post("/", async (context) => {
    const parsed = requestSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_ai_request",
        "Invalid AI request",
        parsed.error.flatten(),
      );
    }
    const userId = context.get("userId");
    const preferences = await database.query(
      "SELECT preferences FROM users WHERE id=$1",
      [userId],
    );
    const savedProvider = providerSchema.safeParse(
      preferences.rows[0]?.preferences?.aiProvider,
    );
    const preferred = savedProvider.success
      ? savedProvider.data
      : parsed.data.provider;
    const connections = await database.query<Connection>(
      `SELECT provider,encrypted_api_key,selected_model,base_url
       FROM provider_connections
       WHERE user_id=$1 AND active=true AND selected_model IS NOT NULL
       ORDER BY CASE WHEN provider=$2 THEN 0 ELSE 1 END,
        last_checked_at DESC NULLS LAST,provider`,
      [userId, preferred ?? ""],
    );
    if (!connections.rows.length) {
      return jsonError(
        context,
        409,
        "provider_required",
        "Connect and select an AI provider in Settings first",
      );
    }
    const system = `${prompts[parsed.data.purpose]}\nContext: ${JSON.stringify(parsed.data.context ?? {})}`;
    const failures: string[] = [];
    for (const connection of connections.rows) {
      try {
        const apiKey = connection.encrypted_api_key
          ? secrets.decrypt(connection.encrypted_api_key)
          : undefined;
        const signal = AbortSignal.any([
          context.req.raw.signal,
          AbortSignal.timeout(60_000),
        ]);
        const text = await providerText(
          connection,
          apiKey,
          system,
          parsed.data.messages,
          transport,
          signal,
        );
        context.header("Cache-Control", "no-store");
        context.header("Content-Type", "text/plain; charset=utf-8");
        context.header("X-AI-Provider", connection.provider);
        return context.body(text);
      } catch {
        failures.push(`${connection.provider}/${connection.selected_model}`);
      }
    }
    return jsonError(
      context,
      502,
      "providers_failed",
      `No active AI provider completed the request. Tried: ${failures.join(", ")}`,
    );
  });
  return routes;
}
