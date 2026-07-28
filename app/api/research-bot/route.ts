import { generateText } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { getModel } from "@/lib/ai";
import { requireUser, unauthorized, getUserTier, getSetting } from "@/lib/api-auth";
import { decryptSecret } from "@/lib/secret-box";
import { providerSchema } from "@/lib/provider-models";
import { isCareerRelevant, offTopicResponse, postFilterResponse } from "@/lib/chat-filter";
import { researchUrl, researchCompany, buildResearchContext } from "@/lib/research";

const requestSchema = z.object({
  message: z.string().min(1).max(5000),
  url: z.string().max(2000).optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(10000),
  })).optional(),
});

const RESEARCH_BOT_SYSTEM = `You are Groove Assistant, the high-energy career research sidekick for CareerGroove. Your job is to help users research companies and roles they are applying for.

When a user sends a job posting or asks about a company:
1. Analyze the job posting and company information provided below
2. Give a punchy, energetic analysis covering:
   - What the company does (product, industry, stage, size)
   - What the role actually entails day-to-day
   - How their background might align (based on any career context they share)
   - Tips for standing out
   - Any red flags or things to watch out for (based on the data)
3. End by asking if they want a tailored resume and/or cover letter

TONE RULES:
- Quirky, energetic, musical — match CareerGroove brand voice
- Use phrases like "let us make your application sing", "groove", "rhythm", "hit the right note"
- Keep it professional — you are a career coach with personality
- Be concise but punchy. No walls of text. Use short paragraphs.
- Use the occasional emoji for flavor 🎵 🎯 💪

IMPORTANT RULES:
- Only discuss career-related topics: jobs, companies, applications, interviews, resumes, networking
- If the user asks about something completely unrelated, gently redirect
- Use the research data below to ground your responses — DO NOT invent company facts
- If research data is limited, be honest: "I could only find limited info on this one"
- Never share personal contact info or generate fake references
- Never imply you are sending messages or submitting applications on their behalf
- When suggesting resume highlights, only use achievements the user has told you about`;

async function getModelForUser(
  userId: string,
): Promise<{ model: ReturnType<typeof getModel>; provider: string } | null> {
  const tier = await getUserTier(userId);

  if (tier === "free") {
    const ollamaBaseUrl = `${(process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/api\/?$/, "").replace(/\/$/, "")}/v1`;
    return {
      model: getModel("ollama", process.env.OLLAMA_MODEL || "llama3.2", undefined, ollamaBaseUrl),
      provider: "ollama",
    };
  }

  const prefs = await db.query("SELECT preferences FROM users WHERE id=$1", [userId]);
  const saved = prefs.rows[0]?.preferences ?? {};
  const preferredProvider = providerSchema.safeParse(saved.aiProvider).success
    ? saved.aiProvider
    : undefined;

  const connections = await db.query(
    `SELECT provider,encrypted_api_key,selected_model,base_url
     FROM provider_connections
     WHERE user_id=$1 AND active=true AND selected_model IS NOT NULL
     ORDER BY CASE WHEN provider=$2 THEN 0 ELSE 1 END,last_checked_at DESC NULLS LAST,provider`,
    [userId, preferredProvider ?? ""],
  );

  for (const connection of connections.rows) {
    try {
      const provider = providerSchema.parse(connection.provider);
      const apiKey = connection.encrypted_api_key
        ? decryptSecret(connection.encrypted_api_key)
        : undefined;
      return { model: getModel(provider, connection.selected_model, apiKey, connection.base_url), provider };
    } catch {
      continue;
    }
  }

  const config = await getSetting("premium_ai_config");
  if (config) {
    const provider = providerSchema.safeParse(config.provider);
    if (provider.success) {
      return {
        model: getModel(provider.data, (config.model as string) || undefined, (config.api_key as string) || undefined, (config.base_url as string) || undefined),
        provider: provider.data,
      };
    }
  }

  return null;
}

export async function POST(request: Request) {
  const userId = await requireUser();
  if (!userId) return unauthorized();

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { message, url, messages: prevMessages } = parsed.data;

  const filter = isCareerRelevant(message + (url || ""));
  if (!filter.allowed) {
    return new Response(offTopicResponse(), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  let researchContext = "";
  let sources: string[] = [];
  let targetTitle = "";
  let targetCompany = "";
  let targetDescription = "";

  if (url) {
    const research = await researchUrl(url);
    researchContext = buildResearchContext(research);
    sources = research.sources;
    targetTitle = research.jobPosting?.title || "";
    targetCompany = research.jobPosting?.company || "";
    targetDescription = research.rawJobText.slice(0, 10000);
    if (!targetCompany && research.companyDomain) {
      targetCompany = research.companyDomain
        .replace(/^www\./, "")
        .replace(/\.(com|io|app|org|net|dev|ai).*$/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  } else {
    const companyMatch = message.match(/(?:research|tell me about|look up|find|what|who)\s+(?:is|about|the)\s+(.+)/i);
    const companyName = companyMatch?.[1]?.trim() || message;
    if (companyName && companyName.length > 2 && companyName.length < 100) {
      const research = await researchCompany(companyName);
      if (research.searchSnippets.length || research.companyWebsiteText) {
        researchContext = buildResearchContext(research);
        sources = research.sources;
        targetCompany = companyName;
      }
    }
  }

  const systemMessage = `${RESEARCH_BOT_SYSTEM}\n\n${researchContext ? `=== RESEARCH DATA ===\n${researchContext}` : "No external research data was available for this query. Use your general knowledge to help, but be clear about what you know versus what you are inferring."}`;

  const modelConfig = await getModelForUser(userId);
  if (!modelConfig) {
    return Response.json(
      { error: "No AI provider available. Connect one in Settings or try again later." },
      { status: 502 },
    );
  }

  const conversationMessages = [
    ...(prevMessages || []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  try {
    const result = await generateText({
      model: modelConfig.model,
      system: systemMessage,
      messages: conversationMessages,
    });

    if (!result.text.trim()) throw new Error("Empty response from model");

    const filtered = postFilterResponse(result.text.trim());

    const responseHeaders: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-AI-Provider": modelConfig.provider,
    };

    if (sources.length) {
      responseHeaders["X-Research-Sources"] = sources.join(",").slice(0, 500);
    }
    if (targetTitle) responseHeaders["X-Target-Title"] = encodeURIComponent(targetTitle);
    if (targetCompany) responseHeaders["X-Target-Company"] = encodeURIComponent(targetCompany);
    if (targetDescription) responseHeaders["X-Target-Description"] = encodeURIComponent(targetDescription);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(filtered));
        controller.close();
      },
    });

    return new Response(stream, { headers: responseHeaders });
  } catch (error) {
    console.error("Research bot failed", error);
    return Response.json(
      { error: "The research assistant hit a snag. Check your AI provider settings and try again." },
      { status: 502 },
    );
  }
}
