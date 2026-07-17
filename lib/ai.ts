import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export type AIProvider = "openai" | "anthropic" | "google" | "ollama";

export function getModel(provider: AIProvider, model?: string) {
  switch (provider) {
    case "anthropic": return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(model ?? "claude-3-5-sonnet-latest");
    case "google": return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(model ?? "gemini-2.0-flash");
    case "ollama": return createOpenAI({ baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1", apiKey: "ollama" })(model ?? "llama3.2");
    default: return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(model ?? "gpt-4o-mini");
  }
}
