import { z } from "zod";
export const providerSchema = z.enum(["openai", "anthropic", "google", "ollama", "nvidia", "kilo"]);
export type ProviderName = z.infer<typeof providerSchema>;
export type AvailableModel = { id: string; name: string };
export type ModelDiscovery = { models: AvailableModel[]; baseUrl?: string };

async function providerFetch(url: string, init: RequestInit, timeout=15000) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout), cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || body?.error || `Provider returned ${response.status}`;
    throw new Error(typeof message === "string" ? message : `Provider returned ${response.status}`);
  }
  return body;
}

export async function discoverModels(provider: ProviderName, apiKey?: string): Promise<ModelDiscovery> {
  let models: AvailableModel[] = [];
  if (provider === "openai") {
    const body = await providerFetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
    const unsupported = /(embedding|whisper|tts|dall-e|moderation|realtime|audio|transcribe|image|search)/i;
    models = (body.data ?? []).map((model: {id:string}) => ({ id: model.id, name: model.id })).filter((model:AvailableModel)=>!unsupported.test(model.id));
  } else if (provider === "anthropic") {
    const body = await providerFetch("https://api.anthropic.com/v1/models?limit=1000", { headers: { "x-api-key": apiKey ?? "", "anthropic-version": "2023-06-01" } });
    models = (body.data ?? []).map((model: {id:string;display_name?:string}) => ({ id: model.id, name: model.display_name || model.id }));
  } else if (provider === "google") {
    const body = await providerFetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": apiKey ?? "" } });
    models = (body.models ?? []).filter((model: {supportedGenerationMethods?:string[]}) => model.supportedGenerationMethods?.includes("generateContent")).map((model: {name:string;displayName?:string;baseModelId?:string}) => ({ id: model.baseModelId || model.name.replace(/^models\//, ""), name: model.displayName || model.name }));
  } else if (provider === "nvidia") {
    const body = await providerFetch("https://api.nvidia.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
    models = (body.data ?? []).map((model: {id:string;name?:string}) => ({ id: model.id, name: model.name || model.id }));
  } else if (provider === "kilo") {
    // Kilo AI Gateway: one OpenAI-compatible endpoint for 500+ models.
    // CareerGroove only surfaces the no-cost "free" models.
    const base = "https://api.kilo.ai/api/gateway";
    const isFree = (id: string) => {
      const lower = id.toLowerCase();
      return lower.endsWith(":free") || lower.endsWith("/free");
    };
    try {
      const body = await providerFetch(`${base}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
      const raw: any[] = Array.isArray(body?.models)
        ? body.models
        : Array.isArray(body?.data)
          ? body.data
          : (body && typeof body === "object"
              ? Object.values(body).filter((value) => value && typeof value === "object" && "id" in (value as any))
              : []) as any[];
      models = raw
        .map((model: any) => ({ id: String(model.id ?? model.name ?? ""), name: String(model.name ?? model.id ?? model.id) }))
        .filter((model: AvailableModel) => model.id && isFree(model.id));
    } catch {
      // Fall back to a curated free list if the live endpoint is unreachable.
    }
    if (!models.length) {
      models = [
        { id: "kilo-auto/free", name: "Kilo Auto Free" },
        { id: "tencent/hy3:free", name: "Tencent Hy3 (free)" },
        { id: "poolside/laguna-s-2.1:free", name: "Poolside Laguna S 2.1 (free)" },
        { id: "poolside/laguna-xs-2.1:free", name: "Poolside Laguna XS 2.1 (free)" },
        { id: "stepfun/step-3.7-flash:free", name: "StepFun Step 3.7 Flash (free)" },
        { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "NVIDIA Nemotron 3 Ultra (free)" },
        { id: "openrouter/free", name: "OpenRouter Free" },
      ];
    }
  } else {
    const candidates=[process.env.OLLAMA_BASE_URL,"http://ollama:11434","http://host.docker.internal:11434","http://localhost:11434"].filter(Boolean).map(url=>(url as string).replace(/\/api\/?$/, "").replace(/\/$/, ""));
    let lastError: unknown;
    for(const base of [...new Set(candidates)]){try{const body=await providerFetch(`${base}/api/tags`,{headers:apiKey?{Authorization:`Bearer ${apiKey}`}:{ }},3000);models=(body.models??[]).map((model:{model?:string;name?:string})=>({id:model.model||model.name||"",name:model.name||model.model||""}));if(models.length)return {models:[...new Map(models.filter(model=>model.id).map(model=>[model.id,model])).values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(0,1000),baseUrl:base};}catch(error){lastError=error}}
    throw lastError instanceof Error?lastError:new Error("No Ollama server with installed models was found.");
  }
  return {models:[...new Map(models.filter((model) => model.id).map((model) => [model.id, model])).values()].sort((a,b) => a.name.localeCompare(b.name)).slice(0, 1000)};
}
