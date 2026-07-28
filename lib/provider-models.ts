import { z } from "zod";
export const providerSchema = z.enum(["openai", "anthropic", "google", "ollama", "nvidia"]);
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
  } else {
    const candidates=[process.env.OLLAMA_BASE_URL,"http://ollama:11434","http://host.docker.internal:11434","http://localhost:11434"].filter(Boolean).map(url=>(url as string).replace(/\/api\/?$/, "").replace(/\/$/, ""));
    let lastError: unknown;
    for(const base of [...new Set(candidates)]){try{const body=await providerFetch(`${base}/api/tags`,{headers:apiKey?{Authorization:`Bearer ${apiKey}`}:{ }},3000);models=(body.models??[]).map((model:{model?:string;name?:string})=>({id:model.model||model.name||"",name:model.name||model.model||""}));if(models.length)return {models:[...new Map(models.filter(model=>model.id).map(model=>[model.id,model])).values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(0,1000),baseUrl:base};}catch(error){lastError=error}}
    throw lastError instanceof Error?lastError:new Error("No Ollama server with installed models was found.");
  }
  return {models:[...new Map(models.filter((model) => model.id).map((model) => [model.id, model])).values()].sort((a,b) => a.name.localeCompare(b.name)).slice(0, 1000)};
}
