import { generateText } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secret-box";
import { providerSchema } from "@/lib/provider-models";

const AI_MAX_RETRIES = 0;

const requestSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "ollama"]).optional(),
  model: z.string().optional(),
  purpose: z
    .enum(["job-interviewer", "job-interview-probe", "mock-interview", "resume", "cover-letter"])
    .default("job-interviewer"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(20000),
      }),
    )
    .min(1),
  context: z.record(z.unknown()).optional(),
});

const prompts = {
  "job-interviewer":
    "Turn the supplied career chapter into as many honest, resume-ready achievement bullets as the supplied content supports, using one bullet for each distinct responsibility, contribution, or outcome worth preserving. Do not target or impose a fixed bullet count. Also provide a concise list of concrete skills demonstrated in the content. Output exactly two plain-text sections: first the line BULLETS, then one finished bullet per line; then the line SKILLS, then one skill per line in exactly this format: Canonical Skill Name | category_key. Allowed category keys are interpersonal_behavioral, cognitive_methodological, technical_digital, business_operational, specialized_vocational, and other. Skill names must be specific technologies, tools, methods, or durable professional capabilities supported by the chapter. Normalize synonyms to one canonical industry-standard name, such as Microsoft Office rather than MS Office, and never return duplicate skills. Do not use Markdown symbols, commentary, suggestions, follow-up questions, placeholders, or requests for more information. Never invent facts or numbers; omit unsupported metrics and skills.",
  "job-interview-probe":
    "Act as an adaptive career-history interviewer for people with any education level or writing ability. Review all supplied answers and prior follow-ups. Decide whether one more question is genuinely needed to understand what the person did, how they did it, who they helped, or what changed because of their work. Ask only one clear, plain-language question at a time. Prefer a specific clarification based on their own words. Useful backups are: what responsibilities people relied on them to handle; what became faster, easier, safer, more accurate, or more successful; and who they worked with or helped. Do not ask about recognition or extra duties because that is always asked separately as the final question. Do not repeat answered questions, request unsupported numbers, or ask for resume wording. Return only valid JSON with this exact shape: {\"needsFollowUp\":true,\"question\":\"...\"} or {\"needsFollowUp\":false,\"question\":\"\"}.",
  "mock-interview":
    "Act as a challenging but supportive reverse mock interviewer. Use supplied career context and give concise coaching after each answer.",
  resume:
    "Create precise, ATS-friendly resume content. Never invent facts; mark missing metrics clearly.",
  "cover-letter":
    "Write a specific, human cover letter grounded only in supplied experience and target-role context.",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { purpose, messages, context } = parsed.data;
  const preferences = await db.query(
    "SELECT preferences FROM users WHERE id=$1",
    [session.user.id],
  );
  const saved = preferences.rows[0]?.preferences ?? {};
  const preferredProvider = providerSchema.safeParse(saved.aiProvider).success
    ? saved.aiProvider
    : parsed.data.provider;
  const connections = await db.query(
    `SELECT provider,encrypted_api_key,selected_model,base_url
     FROM provider_connections
     WHERE user_id=$1 AND active=true AND selected_model IS NOT NULL
     ORDER BY CASE WHEN provider=$2 THEN 0 ELSE 1 END,last_checked_at DESC NULLS LAST,provider`,
    [session.user.id, preferredProvider ?? ""],
  );
  if (!connections.rowCount)
    return Response.json(
      { error: "Connect and select an AI provider in Settings first." },
      { status: 409 },
    );
  const failures: string[] = [];
  for (const connection of connections.rows) {
    const provider = providerSchema.parse(connection.provider);
    const model = connection.selected_model;
    try {
      const apiKey = connection.encrypted_api_key
        ? decryptSecret(connection.encrypted_api_key)
        : undefined;
      const result = await generateText({
        model: getModel(provider, model, apiKey, connection.base_url),
        maxRetries: AI_MAX_RETRIES,
        system: `${prompts[purpose]}\nContext: ${JSON.stringify(context ?? {})}`,
        messages,
      });
      if (!result.text.trim()) throw new Error("The provider returned an empty response.");
      return new Response(result.text, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-AI-Provider": provider,
        },
      });
    } catch (error) {
      failures.push(`${provider}/${model}`);
      console.error("AI provider attempt failed",{provider,model,error:error instanceof Error?error.message:String(error)});
    }
  }
  return Response.json({error:`None of your active AI providers could complete this request. Tried: ${failures.join(", ")}. Your entered information is still available.`},{status:502});
}
