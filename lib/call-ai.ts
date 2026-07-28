import { generateText } from "ai";
import { getModel, type AIProvider } from "@/lib/ai";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secret-box";

export async function callAI(
  userId: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const connections = await db.query(
    `SELECT provider, encrypted_api_key, selected_model, base_url
     FROM provider_connections
     WHERE user_id=$1 AND active=true AND selected_model IS NOT NULL
     ORDER BY last_checked_at DESC NULLS LAST, provider`,
    [userId],
  );

  if (!connections.rowCount) {
    throw new Error("Connect and select an AI provider in Settings first.");
  }

  const failures: string[] = [];
  for (const connection of connections.rows) {
    const provider = connection.provider as AIProvider;
    const model = connection.selected_model as string;
    try {
      const apiKey = connection.encrypted_api_key
        ? decryptSecret(connection.encrypted_api_key)
        : undefined;
      const result = await generateText({
        model: getModel(provider, model, apiKey, connection.base_url),
        maxRetries: 0,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      if (!result.text.trim()) throw new Error("The provider returned an empty response.");
      return result.text;
    } catch (error) {
      failures.push(`${provider}/${model}`);
      console.error("AI provider attempt failed", {
        provider,
        model,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new Error(
    `None of your active AI providers could complete this request. Tried: ${failures.join(", ")}.`,
  );
}
