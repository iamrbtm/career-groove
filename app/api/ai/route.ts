import { generateText } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai";
import { requireUser, unauthorized, getUserTier, getSetting, forbidden } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secret-box";
import { providerSchema } from "@/lib/provider-models";

const AI_MAX_RETRIES = 0;

const requestSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "ollama"]).optional(),
  model: z.string().optional(),
  purpose: z
    .enum(["job-interviewer", "job-interview-probe", "mock-interview", "resume", "cover-letter", "application-answers", "outreach-draft", "soundcheck-brief"])
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
  "application-answers":
    "Answer job application screening questions using only the supplied profile, career, and application context. Be concise, honest, and practical. If context is missing, say what information is needed instead of inventing. Return each answer with a short source/confidence note.",
  "outreach-draft":
    "Draft a concise editable outreach note for a recruiter, referral, hiring manager, thank-you, negotiation, or relationship follow-up. Ground it only in the supplied application/contact context. Do not imply messages were sent.",
  "soundcheck-brief":
    "Create a role-specific interview prep brief using only supplied application, research, documents, and career context. Include likely questions, stories to prepare, weak spots to rehearse, and questions to ask. Do not invent experience.",
};

const PAID_PURPOSES = new Set(["cover-letter", "mock-interview", "soundcheck-brief", "application-answers"]);

async function tryOllama(params: { purpose: string; messages: Array<{ role: string; content: string }>; context?: Record<string, unknown> }) {
  const ollamaBaseUrl = `${(process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/api\/?$/, "").replace(/\/$/, "")}/v1`;
  const result = await generateText({
    model: getModel("ollama", process.env.OLLAMA_MODEL || "llama3.2", undefined, ollamaBaseUrl),
    maxRetries: AI_MAX_RETRIES,
    system: `${prompts[params.purpose as keyof typeof prompts]}\nContext: ${JSON.stringify(params.context ?? {})}`,
    messages: params.messages as any,
  });
  if (!result.text.trim()) throw new Error("The model returned an empty response.");
  return new Response(result.text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-AI-Provider": "ollama" },
  });
}

async function tryPremiumFallback(params: { purpose: string; messages: Array<{ role: string; content: string }>; context?: Record<string, unknown> }) {
  const config = await getSetting("premium_ai_config");
  if (!config) throw new Error("No premium AI provider configured.");
  const provider = providerSchema.safeParse(config.provider);
  if (!provider.success) throw new Error("Invalid premium AI provider configuration.");
  const result = await generateText({
    model: getModel(provider.data, (config.model as string) || undefined, (config.api_key as string) || undefined, (config.base_url as string) || undefined),
    maxRetries: AI_MAX_RETRIES,
    system: `${prompts[params.purpose as keyof typeof prompts]}\nContext: ${JSON.stringify(params.context ?? {})}`,
    messages: params.messages as any,
  });
  if (!result.text.trim()) throw new Error("The premium model returned an empty response.");
  return new Response(result.text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-AI-Provider": provider.data },
  });
}

export async function POST(request: Request) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { purpose, messages, context } = parsed.data;
  const tier = await getUserTier(userId);

  if (tier === "free") {
    if (PAID_PURPOSES.has(purpose)) return forbidden();
    return tryOllama({ purpose, messages, context });
  }

  const preferences = await db.query(
    "SELECT preferences FROM users WHERE id=$1",
    [userId],
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
    [userId, preferredProvider ?? ""],
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
  try {
    return await tryPremiumFallback({ purpose, messages, context });
  } catch (fallbackError) {
    failures.push(`premium-fallback`);
    console.error("Premium AI fallback also failed", fallbackError);
  }
  return Response.json({error:`None of your active AI providers could complete this request. Tried: ${failures.join(", ")}.`},{status:502});
}
