import { generateText } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secret-box";
import { providerSchema } from "@/lib/provider-models";

const requestSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "ollama"]).optional(),
  model: z.string().optional(),
  purpose: z.enum(["job-interviewer", "mock-interview", "resume", "cover-letter"]).default("job-interviewer"),
  messages: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string().max(20000) })).min(1),
  context: z.record(z.unknown()).optional(),
});

const prompts = {
  "job-interviewer": "Turn the user's rough career story into honest, quantified, resume-ready bullets. Ask one focused follow-up when evidence is missing.",
  "mock-interview": "Act as a challenging but supportive reverse mock interviewer. Use supplied career context and give concise coaching after each answer.",
  resume: "Create precise, ATS-friendly resume content. Never invent facts; mark missing metrics clearly.",
  "cover-letter": "Write a specific, human cover letter grounded only in supplied experience and target-role context.",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { purpose, messages, context } = parsed.data;
  const preferences = await db.query("SELECT preferences FROM users WHERE id=$1", [session.user.id]);
  const saved = preferences.rows[0]?.preferences ?? {};
  const providerResult = providerSchema.safeParse(parsed.data.provider ?? saved.aiProvider);
  if (!providerResult.success) return Response.json({ error: "Connect and select an AI provider in Settings first." }, { status: 409 });
  const provider = providerResult.data;
  const connection = await db.query(`SELECT encrypted_api_key,selected_model,base_url FROM provider_connections WHERE user_id=$1 AND provider=$2 AND active=true`, [session.user.id,provider]);
  if (!connection.rowCount) return Response.json({ error: "This AI provider is not fully configured." }, { status: 409 });
  const apiKey = connection.rows[0].encrypted_api_key ? decryptSecret(connection.rows[0].encrypted_api_key) : undefined;
  const model = parsed.data.model ?? connection.rows[0].selected_model;
  try {
    const result = await generateText({
      model: getModel(provider, model, apiKey, connection.rows[0].base_url),
      system: `${prompts[purpose]}\nContext: ${JSON.stringify(context ?? {})}`,
      messages,
    });
    if (!result.text.trim()) throw new Error("The provider returned an empty response.");
    return new Response(result.text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("AI generation failed", { provider, model, error: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: `The ${provider} model ${model} could not complete this request. Try another active model in Settings.` }, { status: 502 });
  }
}
