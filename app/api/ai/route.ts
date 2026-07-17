import { streamText } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai";

const requestSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "ollama"]).default("openai"),
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
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  const { provider, model, purpose, messages, context } = parsed.data;
  const result = streamText({
    model: getModel(provider, model),
    system: `${prompts[purpose]}\nContext: ${JSON.stringify(context ?? {})}`,
    messages,
  });
  return result.toDataStreamResponse();
}
