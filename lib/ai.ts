import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export type AIProvider = "openai" | "anthropic" | "google" | "ollama" | "nvidia";

export function getModel(provider: AIProvider, model?: string, apiKey?: string, baseUrl?: string) {
  switch (provider) {
    case "anthropic": return createAnthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY })(model ?? "claude-3-5-sonnet-latest");
    case "google": return createGoogleGenerativeAI({ apiKey: apiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY })(model ?? "gemini-2.0-flash");
    case "ollama": return createOpenAI({ baseURL: `${(baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/api\/?$/, "").replace(/\/$/, "")}/v1`, apiKey: apiKey ?? "ollama" })(model ?? "llama3.2");
    case "nvidia": return createOpenAI({ baseURL: `${(baseUrl ?? "https://api.nvidia.com").replace(/\/api\/?$/, "").replace(/\/$/, "")}`, apiKey: apiKey ?? process.env.NVIDIA_API_KEY })(model ?? "nvidia/llama-3.3-70b-instruct");
    default: return createOpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY })(model ?? "gpt-4o-mini");
  }
}
