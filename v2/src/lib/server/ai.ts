import { getSetting } from "./settings";

export type AiProvider = "openai" | "anthropic" | "ollama";

export interface AiConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseURL: string;
}

export async function getAiConfig(): Promise<AiConfig | null> {
  const provider = (await getSetting("ai.provider")) as AiProvider | null;
  const model = await getSetting("ai.model");
  const apiKey = await getSetting("ai.apiKey");
  const baseURL = await getSetting("ai.baseURL");
  if (!provider || !model) return null;
  return {
    provider,
    model,
    apiKey: apiKey ?? "",
    baseURL: baseURL ?? "",
  };
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  const config = await getAiConfig();
  if (!config) return { ok: false, error: "No AI provider configured." };
  try {
    if (config.provider === "ollama") {
      const res = await fetch(`${config.baseURL}/api/tags`);
      return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
    }
    if (config.provider === "anthropic") {
      const res = await fetch(`${config.baseURL}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: config.model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
      });
      return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
    }
    const res = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}) },
      body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Connection failed." };
  }
}

export async function aiComplete(
  prompt: string,
  system?: string,
  maxTokens = 1500,
): Promise<string | null> {
  const config = await getAiConfig();
  if (!config) return null;
  const messages = system
    ? [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ]
    : [{ role: "user", content: prompt }];
  try {
    if (config.provider === "ollama") {
      const res = await fetch(`${config.baseURL}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: config.model, messages, stream: false }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.message?.content ?? null;
    }
    if (config.provider === "anthropic") {
      const res = await fetch(`${config.baseURL}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: config.model, max_tokens: maxTokens, messages }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.content?.[0]?.text ?? null;
    }
    const res = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: config.model, messages, max_tokens: maxTokens }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}